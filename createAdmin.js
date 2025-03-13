const readline = require('readline');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const saltRounds = 10;
require("dotenv").config(); // Load environment variables from .env file


// MySQL Database Connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Set up the command line interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for admin username and password
rl.question('Enter admin username: ', (username) => {
  rl.question('Enter admin password: ', (password) => {
    
    // Hash the password before saving
    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        rl.close();
        return;
      }

      // Insert the admin into the database
      const sql = 'INSERT INTO admins (username, password, is_super_admin) VALUES (?, ?, FALSE)';
      db.query(sql, [username, hashedPassword], (err, result) => {
        if (err) {
          console.error('Error creating admin:', err);
        } else {
          console.log('Admin created successfully!');
        }
        rl.close();
      });
    });
  });
});
