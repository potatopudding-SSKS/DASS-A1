const mongoose = require("mongoose");

const connect_fn = async() => {
    try {
        const conn =  await mongoose.connect(process.env.MONGO_URI)
        console.log("Connected to the database")
    } catch (error) {
        console.log(`Error: ${error.message}`)
        process.exit(1)
    }
};

module.exports = connect_fn;