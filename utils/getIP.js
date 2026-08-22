// No IP detection needed - handled by MongoDB driver with Google DNS
// MongoDB will work with default DNS resolution

module.exports = { getPublicIP: () => null };
