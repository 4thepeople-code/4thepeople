const multer = require('multer');
const { AppError } = require('./errorHandler');

const createPdfUpload = (maxSizeMb = 10) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      const isPdfMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
      const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
      if (!isPdfMime && !isPdfExt) {
        return callback(new AppError('Only PDF files are allowed', 400));
      }
      callback(null, true);
    },
  });

const createZipUpload = (maxSizeMb = 25) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      const isZipMime =
        file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.mimetype === 'application/octet-stream';
      const isZipExt = file.originalname.toLowerCase().endsWith('.zip');
      if (!isZipMime && !isZipExt) {
        return callback(new AppError('Only ZIP archive files are allowed (.zip)', 400));
      }
      callback(null, true);
    },
  });

const handleMulterError = (upload, label = 'file') => (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`The uploaded ${label} exceeds the maximum allowed size limit`, 400));
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError(`Unexpected form field '${error.field}' in upload request`, 400));
      }
      return next(new AppError(error.message, 400));
    }
    next(error);
  });
};

module.exports = {
  singlePdf: (fieldName = 'file', maxSizeMb = 10) =>
    handleMulterError(createPdfUpload(maxSizeMb).single(fieldName), 'PDF file'),
  zipArchive: (fieldName = 'archive', maxSizeMb = 25) =>
    handleMulterError(createZipUpload(maxSizeMb).single(fieldName), 'ZIP archive'),
  templatePdf: (fieldName = 'template', maxSizeMb = 10) =>
    handleMulterError(createPdfUpload(maxSizeMb).single(fieldName), 'template PDF'),
};
