const path = require('path');
const fs = require('fs');

const PREDEFINED_TEMPLATES = [
  {
    id: 'tpl-academic-navy',
    name: 'Academic Excellence',
    description: 'Classic Royal Navy & Gold borders with refined serif typography. Ideal for symposiums, seminars, and academic workshops.',
    orientation: 'landscape',
    aspectRatio: 841.89 / 595.28,
    pdfFilename: 'tpl-academic-navy.pdf',
    backgroundColor: '#FCFBF7',
    primaryTextColor: '#0F1D38',
    defaultConfig: [
      { id: 'collegeName', placeholder: '{{collegeName}}', xPercent: 50, yPercent: 12, widthPercent: 85, fontSize: 16, font: 'Times', color: '#0F1D38', align: 'center', autoFit: true },
      { id: 'studentName', placeholder: '{{studentName}}', xPercent: 50, yPercent: 37, widthPercent: 75, fontSize: 26, font: 'TimesBold', color: '#0F1D38', align: 'center', autoFit: true },
      { id: 'rollNumber', placeholder: '{{rollNumber}}', xPercent: 50, yPercent: 42.5, widthPercent: 40, fontSize: 13, font: 'Helvetica', color: '#64748B', align: 'center', autoFit: true },
      { id: 'eventName', placeholder: '{{eventName}}', xPercent: 50, yPercent: 53.5, widthPercent: 70, fontSize: 20, font: 'TimesBold', color: '#0F1D38', align: 'center', autoFit: true },
      { id: 'issueDate', placeholder: '{{issueDate}}', xPercent: 12, yPercent: 92, widthPercent: 30, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'left', autoFit: false },
      { id: 'certificateId', placeholder: '{{certificateId}}', xPercent: 88, yPercent: 92, widthPercent: 35, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'right', autoFit: false },
    ],
  },
  {
    id: 'tpl-modern-cyber',
    name: 'Tech & Innovation',
    description: 'Sleek dark theme with electric cyan brackets and clean sans-serif accents. Ideal for hackathons, coding contests, and tech fests.',
    orientation: 'landscape',
    aspectRatio: 841.89 / 595.28,
    pdfFilename: 'tpl-modern-cyber.pdf',
    backgroundColor: '#0B0F19',
    primaryTextColor: '#F8FAFC',
    defaultConfig: [
      { id: 'collegeName', placeholder: '{{collegeName}}', xPercent: 50, yPercent: 12, widthPercent: 85, fontSize: 15, font: 'HelveticaBold', color: '#38BDF8', align: 'center', autoFit: true },
      { id: 'studentName', placeholder: '{{studentName}}', xPercent: 50, yPercent: 37, widthPercent: 75, fontSize: 25, font: 'HelveticaBold', color: '#F8FAFC', align: 'center', autoFit: true },
      { id: 'rollNumber', placeholder: '{{rollNumber}}', xPercent: 50, yPercent: 42.5, widthPercent: 40, fontSize: 13, font: 'Helvetica', color: '#94A3B8', align: 'center', autoFit: true },
      { id: 'eventName', placeholder: '{{eventName}}', xPercent: 50, yPercent: 53.5, widthPercent: 70, fontSize: 19, font: 'HelveticaBold', color: '#38BDF8', align: 'center', autoFit: true },
      { id: 'issueDate', placeholder: '{{issueDate}}', xPercent: 12, yPercent: 92, widthPercent: 30, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'left', autoFit: false },
      { id: 'certificateId', placeholder: '{{certificateId}}', xPercent: 88, yPercent: 92, widthPercent: 35, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'right', autoFit: false },
    ],
  },
  {
    id: 'tpl-formal-gold',
    name: 'Institutional Distinction',
    description: 'Double charcoal & bronze borders with formal serif layouts. Ideal for conferences, collegiate competitions, and university honors.',
    orientation: 'landscape',
    aspectRatio: 841.89 / 595.28,
    pdfFilename: 'tpl-formal-gold.pdf',
    backgroundColor: '#FFFDF9',
    primaryTextColor: '#1E293B',
    defaultConfig: [
      { id: 'collegeName', placeholder: '{{collegeName}}', xPercent: 50, yPercent: 12, widthPercent: 85, fontSize: 16, font: 'Times', color: '#1E293B', align: 'center', autoFit: true },
      { id: 'studentName', placeholder: '{{studentName}}', xPercent: 50, yPercent: 37, widthPercent: 75, fontSize: 26, font: 'TimesBold', color: '#1E293B', align: 'center', autoFit: true },
      { id: 'rollNumber', placeholder: '{{rollNumber}}', xPercent: 50, yPercent: 42.5, widthPercent: 40, fontSize: 13, font: 'Helvetica', color: '#64748B', align: 'center', autoFit: true },
      { id: 'eventName', placeholder: '{{eventName}}', xPercent: 50, yPercent: 53.5, widthPercent: 70, fontSize: 20, font: 'TimesBold', color: '#B45309', align: 'center', autoFit: true },
      { id: 'issueDate', placeholder: '{{issueDate}}', xPercent: 12, yPercent: 92, widthPercent: 30, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'left', autoFit: false },
      { id: 'certificateId', placeholder: '{{certificateId}}', xPercent: 88, yPercent: 92, widthPercent: 35, fontSize: 11, font: 'Helvetica', color: '#64748B', align: 'right', autoFit: false },
    ],
  },
];

function getPredefinedTemplates() {
  return PREDEFINED_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    orientation: t.orientation,
    aspectRatio: t.aspectRatio,
    backgroundColor: t.backgroundColor,
    primaryTextColor: t.primaryTextColor,
    defaultConfig: t.defaultConfig,
  }));
}

function getPredefinedTemplatePdfBuffer(id) {
  const item = PREDEFINED_TEMPLATES.find((t) => t.id === id);
  if (!item) return null;
  const filePath = path.join(__dirname, item.pdfFilename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function getPredefinedTemplateById(id) {
  return PREDEFINED_TEMPLATES.find((t) => t.id === id) || null;
}

module.exports = {
  PREDEFINED_TEMPLATES,
  getPredefinedTemplates,
  getPredefinedTemplatePdfBuffer,
  getPredefinedTemplateById,
};
