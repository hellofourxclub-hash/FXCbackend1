const { google } = require('googleapis');

const getDriveClient = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive service account is not configured');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const grantViewerAccess = async ({ folderId, email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!folderId) throw new Error('Google Drive folder is not configured');
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(normalizedEmail)) {
    throw new Error('Valid Google email is required');
  }

  const drive = getDriveClient();

  const existing = await drive.permissions.list({
    fileId: folderId,
    fields: 'permissions(id,type,emailAddress,role)',
    supportsAllDrives: true,
    pageSize: 100,
  });

  const found = (existing.data.permissions || []).find(
    (permission) => permission.type === 'user' && normalizeEmail(permission.emailAddress) === normalizedEmail
  );

  if (found) {
    // Never modify a permission that FXC did not create. This preserves existing
    // editor/owner-managed access and avoids destructive changes on revocation.
    return {
      permissionId: found.id,
      role: found.role,
      alreadyExists: true,
      managed: false,
    };
  }

  const created = await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: 'user',
      role: 'reader',
      emailAddress: normalizedEmail,
    },
    sendNotificationEmail: true,
    supportsAllDrives: true,
    fields: 'id',
  });

  return {
    permissionId: created.data.id,
    role: 'reader',
    alreadyExists: false,
    managed: true,
  };
};

const revokeAccess = async ({ folderId, permissionId }) => {
  if (!folderId || !permissionId) return false;
  const drive = getDriveClient();
  try {
    await drive.permissions.delete({
      fileId: folderId,
      permissionId,
      supportsAllDrives: true,
    });
    return true;
  } catch (error) {
    if (error?.code === 404) return false;
    throw error;
  }
};

module.exports = { grantViewerAccess, revokeAccess, normalizeEmail };
