import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readExcel} from '../web/excel.js';

// One ZIP member is sufficient: reject its real size before parsing table XML.
function archive(content, reportedSize, method = 8) {
 const name = Buffer.from('xl/tables/table1.xml');
 const payload = method === 8 ? deflateRawSync(content) : content;
 const local = Buffer.alloc(30);
 local.writeUInt32LE(0x04034b50); local.writeUInt16LE(method,8);
 local.writeUInt32LE(payload.length,18); local.writeUInt32LE(reportedSize,22); local.writeUInt16LE(name.length,26);
 const central = Buffer.alloc(46);
 central.writeUInt32LE(0x02014b50); central.writeUInt16LE(method,10);
 central.writeUInt32LE(payload.length,20); central.writeUInt32LE(reportedSize,24); central.writeUInt16LE(name.length,28);
 const end = Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1,8); end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+name.length,12); end.writeUInt32LE(local.length+name.length+payload.length,16);
 const zip=Buffer.concat([local,name,payload,central,name,end]);
 return zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength);
}

test('Excel rejects actual decompressed output above 30 MiB before XML parsing',async t=>{
 const previous=global.DOMParser; let parsed=false;
 global.DOMParser=class{parseFromString(){parsed=true;throw Error('XML parser reached');}};
 t.after(()=>{global.DOMParser=previous;});
 await assert.rejects(readExcel(archive(Buffer.alloc(30*1024*1024+1,65),1),'unsafe.xlsx'),/Excelonderdeel te groot/);
 assert.equal(parsed,false);
});

test('Excel rejects false ZIP member sizes for compressed and stored XML',async t=>{
 const previous=global.DOMParser; let parsed=false;
 global.DOMParser=class{parseFromString(){parsed=true;throw Error('XML parser reached');}};
 t.after(()=>{global.DOMParser=previous;});
 for(const method of [0,8])await assert.rejects(readExcel(archive(Buffer.from('<table/>'),1,method),'damaged.xlsx'),/grootte|Beschadigd/);
 assert.equal(parsed,false);
});

test('Valid ZIP member reaches XML parser with the original UTF-8 text',async t=>{
 const previous=global.DOMParser;const xml='<table name="ILS_Gevel">één</table>';
 global.DOMParser=class{parseFromString(text){assert.equal(text,xml);throw Error('Expected XML boundary');}};
 t.after(()=>{global.DOMParser=previous;});
 for(const method of [0,8])await assert.rejects(readExcel(archive(Buffer.from(xml),Buffer.byteLength(xml),method),'valid.xlsx'),/Expected XML boundary/);
});
