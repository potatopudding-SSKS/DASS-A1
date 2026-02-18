const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connect_fn = require("./config/db");

dotenv.config();
connect_fn();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use('/api/events', require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use("/api/team", require("./routes/team"));
app.use("/api/teams", require("./routes/team"));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/discussions', require('./routes/discussions'));
app.use('/api/password-reset', require('./routes/password_reset'));
app.use('/api/password_reset', require('./routes/password_reset'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/organisers', require('./routes/organisers'));
app.use('/api/organizers', require('./routes/organisers'));


app.get("/api/health", (req, res) => {
    res.json({status:"ok", message:"Server Up"});
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({message:"Something went awry"});
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port: ${port}`));
