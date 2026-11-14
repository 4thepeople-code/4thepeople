const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'templates');

if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// Convert hex string to pdf-lib rgb()
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * 1. Template: Academic Excellence (Navy & Gold, A4 Landscape: 841.89 x 595.28 pt)
 */
async function generateAcademicNavyTemplate() {
  const pdfDoc = await PDFDocument.create();
  const width = 841.89;
  const height = 595.28;
  const page = pdfDoc.addPage([width, height]);

  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background Fill (Soft warm parchment)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: hexToRgb('#FCFBF7'),
  });

  // Outer Border: Deep Navy (8pt)
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: hexToRgb('#0F1D38'),
    borderWidth: 7,
  });

  // Inner Border: Fine Gold (1.5pt)
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: hexToRgb('#D4AF37'),
    borderWidth: 1.5,
  });

  // Corner decorative squares
  const corners = [
    [24, 24],
    [width - 32, 24],
    [24, height - 32],
    [width - 32, height - 32],
  ];
  for (const [cx, cy] of corners) {
    page.drawRectangle({
      x: cx,
      y: cy,
      width: 8,
      height: 8,
      color: hexToRgb('#D4AF37'),
    });
  }

  // Header Title
  const titleText = 'CERTIFICATE OF PARTICIPATION';
  const titleWidth = timesBold.widthOfTextAtSize(titleText, 26);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 26,
    font: timesBold,
    color: hexToRgb('#0F1D38'),
  });

  // Gold header divider
  page.drawLine({
    start: { x: (width - 240) / 2, y: height - 132 },
    end: { x: (width + 240) / 2, y: height - 132 },
    thickness: 1.5,
    color: hexToRgb('#D4AF37'),
  });

  // Subtitle
  const subText = 'THIS IS PROUDLY PRESENTED TO';
  const subWidth = helvetica.widthOfTextAtSize(subText, 10);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 165,
    size: 10,
    font: helvetica,
    color: hexToRgb('#64748B'),
  });

  // Line for Student Name
  page.drawLine({
    start: { x: (width - 440) / 2, y: height - 238 },
    end: { x: (width + 440) / 2, y: height - 238 },
    thickness: 1,
    color: hexToRgb('#E2E8F0'),
  });

  // Secondary text
  const forText = 'for active and meritorious participation in';
  const forWidth = times.widthOfTextAtSize(forText, 12);
  page.drawText(forText, {
    x: (width - forWidth) / 2,
    y: height - 275,
    size: 12,
    font: times,
    color: hexToRgb('#64748B'),
  });

  // Line for Event Title
  page.drawLine({
    start: { x: (width - 380) / 2, y: height - 338 },
    end: { x: (width + 380) / 2, y: height - 338 },
    thickness: 1,
    color: hexToRgb('#E2E8F0'),
  });

  // Signature Lines
  // Left: Authorized Signature
  page.drawLine({
    start: { x: 100, y: 130 },
    end: { x: 280, y: 130 },
    thickness: 1,
    color: hexToRgb('#94A3B8'),
  });
  const sig1 = 'Authorized Signature';
  const sig1Width = helvetica.widthOfTextAtSize(sig1, 9);
  page.drawText(sig1, {
    x: 190 - sig1Width / 2,
    y: 114,
    size: 9,
    font: helvetica,
    color: hexToRgb('#64748B'),
  });

  // Right: Event Organizer
  page.drawLine({
    start: { x: width - 280, y: 130 },
    end: { x: width - 100, y: 130 },
    thickness: 1,
    color: hexToRgb('#94A3B8'),
  });
  const sig2 = 'Event Organizer';
  const sig2Width = helvetica.widthOfTextAtSize(sig2, 9);
  page.drawText(sig2, {
    x: (width - 190) - sig2Width / 2,
    y: 114,
    size: 9,
    font: helvetica,
    color: hexToRgb('#64748B'),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'tpl-academic-navy.pdf'), Buffer.from(pdfBytes));
  console.log('✔ Generated tpl-academic-navy.pdf');
}

/**
 * 2. Template: Tech & Innovation (Cyber Dark, A4 Landscape: 841.89 x 595.28 pt)
 */
async function generateModernCyberTemplate() {
  const pdfDoc = await PDFDocument.create();
  const width = 841.89;
  const height = 595.28;
  const page = pdfDoc.addPage([width, height]);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background Fill (Deep Obsidian)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: hexToRgb('#0B0F19'),
  });

  // Outer Border: Electric Cyan (2.5pt)
  page.drawRectangle({
    x: 22,
    y: 22,
    width: width - 44,
    height: height - 44,
    borderColor: hexToRgb('#06B6D4'),
    borderWidth: 2,
  });

  // Tech Corner Brackets
  const bracketLen = 20;
  // Top-left bracket accent
  page.drawLine({ start: { x: 18, y: height - 18 }, end: { x: 18 + bracketLen, y: height - 18 }, thickness: 4, color: hexToRgb('#38BDF8') });
  page.drawLine({ start: { x: 18, y: height - 18 }, end: { x: 18, y: height - 18 - bracketLen }, thickness: 4, color: hexToRgb('#38BDF8') });

  // Top-right bracket accent
  page.drawLine({ start: { x: width - 18, y: height - 18 }, end: { x: width - 18 - bracketLen, y: height - 18 }, thickness: 4, color: hexToRgb('#38BDF8') });
  page.drawLine({ start: { x: width - 18, y: height - 18 }, end: { x: width - 18, y: height - 18 - bracketLen }, thickness: 4, color: hexToRgb('#38BDF8') });

  // Bottom-left bracket accent
  page.drawLine({ start: { x: 18, y: 18 }, end: { x: 18 + bracketLen, y: 18 }, thickness: 4, color: hexToRgb('#38BDF8') });
  page.drawLine({ start: { x: 18, y: 18 }, end: { x: 18, y: 18 + bracketLen }, thickness: 4, color: hexToRgb('#38BDF8') });

  // Bottom-right bracket accent
  page.drawLine({ start: { x: width - 18, y: 18 }, end: { x: width - 18 - bracketLen, y: 18 }, thickness: 4, color: hexToRgb('#38BDF8') });
  page.drawLine({ start: { x: width - 18, y: 18 }, end: { x: width - 18, y: 18 + bracketLen }, thickness: 4, color: hexToRgb('#38BDF8') });

  // Header Title
  const titleText = 'CERTIFICATE OF ACHIEVEMENT';
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 25);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 25,
    font: helveticaBold,
    color: hexToRgb('#F8FAFC'),
  });

  // Cyan divider line
  page.drawLine({
    start: { x: (width - 260) / 2, y: height - 132 },
    end: { x: (width + 260) / 2, y: height - 132 },
    thickness: 2,
    color: hexToRgb('#06B6D4'),
  });

  // Subtitle
  const subText = 'THIS RECOGNITION IS PROUDLY CONFERRED UPON';
  const subWidth = helvetica.widthOfTextAtSize(subText, 9.5);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 165,
    size: 9.5,
    font: helvetica,
    color: hexToRgb('#94A3B8'),
  });

  // Name underline
  page.drawLine({
    start: { x: (width - 440) / 2, y: height - 238 },
    end: { x: (width + 440) / 2, y: height - 238 },
    thickness: 1,
    color: hexToRgb('#1E293B'),
  });

  // Secondary text
  const forText = 'for demonstrated technical excellence and outstanding performance in';
  const forWidth = helvetica.widthOfTextAtSize(forText, 11);
  page.drawText(forText, {
    x: (width - forWidth) / 2,
    y: height - 275,
    size: 11,
    font: helvetica,
    color: hexToRgb('#94A3B8'),
  });

  // Event title underline
  page.drawLine({
    start: { x: (width - 380) / 2, y: height - 338 },
    end: { x: (width + 380) / 2, y: height - 338 },
    thickness: 1,
    color: hexToRgb('#1E293B'),
  });

  // Signature lines
  page.drawLine({ start: { x: 100, y: 130 }, end: { x: 280, y: 130 }, thickness: 1, color: hexToRgb('#334155') });
  const sig1 = 'Program Lead';
  const sig1Width = helvetica.widthOfTextAtSize(sig1, 9);
  page.drawText(sig1, { x: 190 - sig1Width / 2, y: 114, size: 9, font: helvetica, color: hexToRgb('#64748B') });

  page.drawLine({ start: { x: width - 280, y: 130 }, end: { x: width - 100, y: 130 }, thickness: 1, color: hexToRgb('#334155') });
  const sig2 = 'Technical Coordinator';
  const sig2Width = helvetica.widthOfTextAtSize(sig2, 9);
  page.drawText(sig2, { x: (width - 190) - sig2Width / 2, y: 114, size: 9, font: helvetica, color: hexToRgb('#64748B') });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'tpl-modern-cyber.pdf'), Buffer.from(pdfBytes));
  console.log('✔ Generated tpl-modern-cyber.pdf');
}

/**
 * 3. Template: Formal Distinction (Warm Charcoal & Gold, A4 Landscape: 841.89 x 595.28 pt)
 */
async function generateFormalGoldTemplate() {
  const pdfDoc = await PDFDocument.create();
  const width = 841.89;
  const height = 595.28;
  const page = pdfDoc.addPage([width, height]);

  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background Fill (Warm Linen Ivory)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: hexToRgb('#FFFDF9'),
  });

  // Outer Border: Charcoal (4pt)
  page.drawRectangle({
    x: 22,
    y: 22,
    width: width - 44,
    height: height - 44,
    borderColor: hexToRgb('#1E293B'),
    borderWidth: 4,
  });

  // Inner Border: Bronze Gold (2pt)
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: hexToRgb('#B45309'),
    borderWidth: 1.5,
  });

  // Header Title
  const titleText = 'CERTIFICATE OF MERIT';
  const titleWidth = timesBold.widthOfTextAtSize(titleText, 27);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 27,
    font: timesBold,
    color: hexToRgb('#1E293B'),
  });

  // Double gold divider line
  page.drawLine({
    start: { x: (width - 240) / 2, y: height - 132 },
    end: { x: (width + 240) / 2, y: height - 132 },
    thickness: 1.5,
    color: hexToRgb('#B45309'),
  });
  page.drawLine({
    start: { x: (width - 200) / 2, y: height - 135 },
    end: { x: (width + 200) / 2, y: height - 135 },
    thickness: 0.8,
    color: hexToRgb('#B45309'),
  });

  // Subtitle
  const subText = 'THIS CERTIFICATE IS PROUDLY PRESENTED TO';
  const subWidth = helvetica.widthOfTextAtSize(subText, 9.5);
  page.drawText(subText, {
    x: (width - subWidth) / 2,
    y: height - 165,
    size: 9.5,
    font: helvetica,
    color: hexToRgb('#64748B'),
  });

  // Name underline
  page.drawLine({
    start: { x: (width - 440) / 2, y: height - 238 },
    end: { x: (width + 440) / 2, y: height - 238 },
    thickness: 1,
    color: hexToRgb('#CBD5E1'),
  });

  // Secondary text
  const forText = 'in special recognition of distinguished participation and contribution to';
  const forWidth = times.widthOfTextAtSize(forText, 12);
  page.drawText(forText, {
    x: (width - forWidth) / 2,
    y: height - 275,
    size: 12,
    font: times,
    color: hexToRgb('#64748B'),
  });

  // Event title underline
  page.drawLine({
    start: { x: (width - 380) / 2, y: height - 338 },
    end: { x: (width + 380) / 2, y: height - 338 },
    thickness: 1,
    color: hexToRgb('#CBD5E1'),
  });

  // Signatures
  page.drawLine({ start: { x: 100, y: 130 }, end: { x: 280, y: 130 }, thickness: 1, color: hexToRgb('#94A3B8') });
  const sig1 = 'Dean / Principal';
  const sig1Width = helvetica.widthOfTextAtSize(sig1, 9);
  page.drawText(sig1, { x: 190 - sig1Width / 2, y: 114, size: 9, font: helvetica, color: hexToRgb('#64748B') });

  page.drawLine({ start: { x: width - 280, y: 130 }, end: { x: width - 100, y: 130 }, thickness: 1, color: hexToRgb('#94A3B8') });
  const sig2 = 'Convenor';
  const sig2Width = helvetica.widthOfTextAtSize(sig2, 9);
  page.drawText(sig2, { x: (width - 190) - sig2Width / 2, y: 114, size: 9, font: helvetica, color: hexToRgb('#64748B') });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'tpl-formal-gold.pdf'), Buffer.from(pdfBytes));
  console.log('✔ Generated tpl-formal-gold.pdf');
}

async function main() {
  await generateAcademicNavyTemplate();
  await generateModernCyberTemplate();
  await generateFormalGoldTemplate();
  console.log('🎉 All 3 predefined PDF templates successfully generated!');
}

main().catch(console.error);
