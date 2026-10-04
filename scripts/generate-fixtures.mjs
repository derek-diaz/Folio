import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import JSZip from 'jszip';

for (const folder of ['pdf', 'docx', 'markdown', 'text', 'csv', 'images']) await mkdir(`tests/fixtures/${folder}`, { recursive: true });
// Small, valid PDF with a real xref table, two pages and selectable Helvetica text.
const stream = (heading, body) => `BT /F1 24 Tf 60 720 Td (${heading}) Tj /F1 12 Tf 0 -40 Td (${body}) Tj ET`;
const streams = [stream('Folio PDF fixture', 'Searchable documents belong on your own device.'), stream('A second page', 'The document continues here. Read, find, copy, print.')];
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  ...[0, 1].map(i => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents ${i + 6} 0 R >>`),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ...streams.map(content => `<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await writeFile('tests/fixtures/pdf/reading.pdf', pdf);

const zip = new JSZip();
const types = 'http://schemas.openxmlformats.org/package/2006/content-types';
const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
zip.file('_rels/.rels', `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file('word/_rels/document.xml.rels', `<Relationships xmlns="${rels}"><Relationship Id="styles" Type="${office}/styles" Target="styles.xml"/><Relationship Id="link" Type="${office}/hyperlink" Target="https://example.com" TargetMode="External"/><Relationship Id="image" Type="${office}/image" Target="media/image.png"/></Relationships>`);
zip.file('word/styles.xml', `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`);
zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${office}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>A quieter way to read</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">This document includes </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold words</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:r><w:rPr><w:i/><w:u w:val="single"/></w:rPr><w:t>underlined italics</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>
<w:p><w:hyperlink r:id="link"><w:r><w:t>An intentional external link</w:t></w:r></w:hyperlink></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Format</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Purpose</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>DOCX</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Readable local documents</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Folio mark" descr="Embedded fixture image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`);
zip.file('word/media/image.png', await readFile('src-tauri/icons/128x128.png'));
await writeFile('tests/fixtures/docx/reading.docx', await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
await copyFile('src-tauri/icons/128x128.png', 'tests/fixtures/images/folio.png');
console.log('Generated valid PDF, DOCX and PNG fixtures.');
