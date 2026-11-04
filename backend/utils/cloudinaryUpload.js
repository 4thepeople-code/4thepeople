const cloudinary = require('../config/cloudinary');

const isTestEnv = process.env.NODE_ENV === 'test';

const verifyTestSafety = () => {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!dbUrl.includes('yuva_test')) {
    throw new Error('Safety violation: Cloudinary test stub can only be used when database is strictly yuva_test');
  }
};

const mockJournal = {
  uploads: [],
  deletes: [],
  clear() {
    this.uploads = [];
    this.deletes = [];
  },
};

const uploadBuffer = (buffer, folder) => {
  if (isTestEnv) {
    verifyTestSafety();
    const mockId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const result = {
      url: `https://res.cloudinary.com/test-cloud/image/upload/${folder}/${mockId}.jpg`,
      publicId: `${folder}/${mockId}`,
    };
    mockJournal.uploads.push(result);
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
};

const deleteAsset = (publicId) => {
  if (isTestEnv) {
    verifyTestSafety();
    mockJournal.deletes.push(publicId);
    return Promise.resolve({ result: 'ok' });
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
  });
};

// Asset deletion must not prevent a related database record from being deleted.
// Any failed cleanup is logged for later recovery instead of aborting the delete.
const deleteAssetsBestEffort = async (publicIds, context) => {
  const assets = publicIds.filter(Boolean);
  const results = await Promise.allSettled(assets.map((publicId) => deleteAsset(publicId)));

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`Failed to delete Cloudinary asset for ${context}:`, result.reason);
    }
  });
};

module.exports = { uploadBuffer, deleteAsset, deleteAssetsBestEffort, mockJournal };
