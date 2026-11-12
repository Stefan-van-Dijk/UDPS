"""Extract ILS_Gevel from the supplied workbook without running VBA."""
import sys,zipfile,xml.etree.ElementTree as E,json
z=zipfile.ZipFile(sys.argv[1]);n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
s=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',n)]
cells={c.attrib['r']:s[int(c.findtext('m:v','0',n))] if c.attrib.get('t')=='s' else c.findtext('m:v','',n) for c in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:sheetData/m:row/m:c',n)}
h=[cells[chr(c)+'4'].replace('IfcWindowsw','IfcWindow') for c in range(66,81)]
rows=[{h[c-66]:cells.get(chr(c)+str(r),'') for c in range(66,81)} for r in range(5,64)]
d={'version':1,'source':'UDPSgen.xlsm','headers':h,'rows':rows,'mode':'I/T','skipEmpty':False}
open('web/initial.json','w').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
open('web/data.js','w').write('export default '+json.dumps(d,ensure_ascii=False)+';\n')
print(len(rows),'rows extracted')
