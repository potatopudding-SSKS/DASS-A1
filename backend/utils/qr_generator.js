const qrcode = require("qrcode");

exports.generate_qr_code = async (data) => {
    try {
        return await qrcode.toDataURL(JSON.stringify(data));
    } catch (error) {
        console.error("QR Code generation failed");
        throw error;
    }
};