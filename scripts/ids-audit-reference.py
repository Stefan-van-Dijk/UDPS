#!/usr/bin/env python3
"""Run the pinned official buildingSMART IDS audit as a development reference.

Requires a .NET 8 runtime/SDK, never installs software on the user's computer.
Only the public tool package is downloaded. Input IDS contents stay local.
Usage: python3 scripts/ids-audit-reference.py --self-test [--dotnet /path/to/dotnet]
       python3 scripts/ids-audit-reference.py path/to/document.ids
This reference is deliberately separate from the browser's XSD-only check.
"""
import argparse
import base64
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
import io

VERSION = '1.0.124'
PACKAGE_URL = f'https://api.nuget.org/v3-flatcontainer/ids-tool.commandline/{VERSION}/ids-tool.commandline.{VERSION}.nupkg'
PACKAGE_SHA512 = 'O0puBowyRCAQhvWtMzu6FnIoCxt9td7w7oVKZrcBApXQV17kf+bbIJm9H/8kekWieo4b5rfM15GHF0fWGbjuvQ=='
MAX_PACKAGE_BYTES = 10 * 1024 * 1024
MAX_INPUT_BYTES = 10 * 1024 * 1024


def prepare_tool(cache):
    """Verify every package, then extract only relative safe members into cache."""
    archive = cache / f'ids-tool.commandline.{VERSION}.nupkg'
    if not archive.exists():
        with urllib.request.urlopen(PACKAGE_URL, timeout=30) as response:
            data = response.read(MAX_PACKAGE_BYTES + 1)
    else:
        data = archive.read_bytes()
    if len(data) > MAX_PACKAGE_BYTES or base64.b64encode(hashlib.sha512(data).digest()).decode() != PACKAGE_SHA512:
        raise ValueError('The pinned official IDS audit package digest does not match.')
    cache.mkdir(parents=True, exist_ok=True)
    # Cache only the verified archive. Each invocation gets its own extraction:
    # rewriting DLLs used by a concurrent reference run can cause SIGBUS.
    with tempfile.NamedTemporaryFile(prefix='package-', suffix='.tmp', dir=cache, delete=False) as temporary_archive:
        temporary_archive.write(data)
        archive_temp = Path(temporary_archive.name)
    archive_temp.replace(archive)
    extraction = Path(tempfile.mkdtemp(prefix='run-', dir=cache))
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        if len(source.infolist()) > 300 or sum(x.file_size for x in source.infolist()) > 30 * 1024 * 1024:
            raise ValueError('Unexpected tool package contents.')
        for info in source.infolist():
            path = Path(info.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in info.filename:
                raise ValueError('Unsafe tool package member.')
        source.extractall(extraction)
    tool = extraction / 'tools/net8.0/any/ids-tool.dll'
    if not tool.is_file():
        raise ValueError('Expected .NET 8 audit payload is missing.')
    return tool, extraction


def run_audit(dotnet, tool, path):
    path = Path(path).resolve()
    if not path.is_file() or path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError('Expected an existing IDS input of at most 10 MiB.')
    result = subprocess.run([dotnet, str(tool), 'audit', str(path)], capture_output=True, text=True, timeout=60, check=False)
    output = result.stdout + result.stderr
    # Linux process return codes truncate status flags to 8 bits. Do not treat a
    # zero exit code as success unless the official completion message is Ok.
    ok = result.returncode == 0 and 'Completed with status: Ok.' in output
    completion = re.findall(r'Completed with status: ([^.]+)', output)
    # The CLI batch path may not recognise a source with no version hint, even
    # though schemaLocation is optional XML metadata. An unsupported/incomplete
    # run is not evidence that the IDS itself is invalid.
    flags = result.returncode
    tokens = set(completion[-1].split(', ')) if completion else set()
    invalid_tokens = {'IdsStructureError', 'IdsContentError'}
    known_invalid = flags >= 0 and bool(tokens) and tokens.issubset(invalid_tokens) and flags in [8, 16, 24]
    status = 'valid' if ok else 'invalid' if known_invalid else 'unsupported' if flags >= 0 and 'NotImplementedError' in tokens else 'unavailable'
    return {'file': path.name, 'status': status, 'valid': ok, 'complete': status in ['valid', 'invalid'], 'exitCode': flags, 'completion': completion, 'output': output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*')
    parser.add_argument('--dotnet', default=os.environ.get('UDPS_DOTNET') or shutil.which('dotnet'))
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / ('udps-ids-audit-' + VERSION))
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if not args.dotnet:
        print(json.dumps({'status':'unavailable','message':'A .NET 8 runtime/SDK is required for the official reference audit; the browser XSD check does not need it.'}))
        return 2
    extraction = None
    try:
        tool, extraction = prepare_tool(args.cache)
        if args.self_test:
            example = Path(__file__).resolve().parent.parent / 'web/examples/required-property.ids'
            xml = example.read_text(encoding='utf-8')
            with tempfile.TemporaryDirectory(prefix='udps-ids-reference-') as temporary:
                base = Path(temporary)
                cases = [('valid.ids', xml, True),
                         ('xsd-invalid.ids', xml.replace('ifcVersion="IFC2X3 IFC4"', ''), False),
                         ('semantic-invalid.ids', xml.replace('IFCWALL', 'IFCMADEUPENTITY'), False)]
                reports = []
                for name, content, expected in cases:
                    path = base / name
                    path.write_text(content, encoding='utf-8')
                    report = run_audit(args.dotnet, tool, path)
                    reports.append({'case':name, 'status':report['status'], 'valid':report['valid'], 'expected':expected, 'exitCode':report['exitCode']})
                    if not report['complete'] or report['status'] != ('valid' if expected else 'invalid') or report['valid'] != expected:
                        raise ValueError('Official reference check disagrees with expected result: ' + name + '\n' + report['output'])
            print(json.dumps({'status':'passed','tool':'buildingSMART ids-tool.CommandLine','version':VERSION,'checks':reports}))
            return 0
        if not args.files:
            parser.error('Pass an IDS file or --self-test.')
        results = [run_audit(args.dotnet, tool, path) for path in args.files]
        print(json.dumps({'tool':'buildingSMART ids-tool.CommandLine','version':VERSION,'results':results}))
        return 0 if all(result['valid'] for result in results) else 1
    except (OSError, ValueError, subprocess.TimeoutExpired, zipfile.BadZipFile) as error:
        print(json.dumps({'status':'unavailable','message':str(error)}))
        return 2
    finally:
        if extraction is not None:
            shutil.rmtree(extraction)


if __name__ == '__main__':
    sys.exit(main())
