const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

// Set view engine to EJS
app.set("view engine", "ejs");

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL connected...");

  // Create bookings table if not exists
  db.query(
    `CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      service VARCHAR(50) NOT NULL,
      booking_date DATE NOT NULL
    )`,
    (err) => {
      if (err) throw err;
      console.log("Bookings table ready.");
    }
  );
});

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Middleware to Check Admin Authentication
const isAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(403).send("Access denied. Admins only.");
};

// Routes
app.get("/", (req, res) => res.render("index"));
app.get("/about", (req, res) => res.render("about"));
app.get("/services", (req, res) => res.render("service"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/booking", (req, res) => res.render("booking"));
app.get("/adminLogin", (req, res) => res.render("adminLogin", { error: null }));

// Admin Login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render("adminLogin", { error: "Username and Password are required." });
  }

  db.query("SELECT * FROM admins WHERE username = ?", [username], (err, results) => {
    if (err) {
      console.error("Error fetching admin:", err);
      return res.status(500).send("Error logging in.");
    }

    if (results.length === 0) {
      return res.render("adminLogin", { error: "Invalid credentials." });
    }

    const admin = results[0];
    bcrypt.compare(password, admin.password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.render("adminLogin", { error: "Invalid credentials." });
      }

      req.session.isAdmin = true;
      res.redirect("/adminDashboard");
    });
  });
});

// Admin Dashboard
app.get("/adminDashboard", isAdmin, (req, res) => {
  db.query("SELECT * FROM bookings", (err, results) => {
    if (err) {
      console.error("Error fetching bookings:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.render("adminDashboard", { bookings: results });
  });
});

app.get('/admin/dashboard', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get current page, default to 1 if none provided
  const pageSize = 10; // Number of bookings per page
  const offset = (page - 1) * pageSize;

  // Assuming you are using a database query, for example with MySQL or MongoDB:
  const bookings = await Booking.find() // Replace with your DB query
    .skip(offset)
    .limit(pageSize);

  const totalBookings = await Booking.countDocuments(); // Get total bookings count
  const totalPages = Math.ceil(totalBookings / pageSize);

  res.render('adminDashboard', {
    bookings,
    currentPage: page,
    totalPages,
  });
});


// Gallery Route
app.get("/gallery", (req, res) => {
  const imageDir = path.join(__dirname, "uploads/images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("Error reading images directory:", err);
      return res.status(500).send("Error loading gallery.");
    }
    const images = files.filter((file) => file.endsWith(".jpg") || file.endsWith(".png"));
    res.render("gallery", { images });
  });
});

// Booking Submission
app.post("/booking", (req, res) => {
  const { name, email, phone, service, booking_date } = req.body;
  if (!name || !email || !phone || !service || !booking_date) {
    return res.status(400).send("All fields are required.");
  }

  const query = "INSERT INTO bookings (name, email, phone, service, booking_date) VALUES (?, ?, ?, ?, ?)";
  db.query(query, [name, email, phone, service, booking_date], (err) => {
    if (err) {
      console.error("Error saving booking:", err);
      return res.status(500).send("Error processing your booking.");
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Booking Confirmation - Kkelly Photography",
      text: `Dear ${name},\n\nThank you for booking with Kkelly Photography! Your booking for ${service} on ${booking_date} is confirmed.\n\nBest regards,\nKkelly Photography Team`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) console.error("Error sending confirmation email:", error);
    });

    res.render("booking", { message: "Booking successful! We will contact you soon." });
  });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
