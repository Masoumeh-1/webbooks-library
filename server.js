// Set up Express and Handlebars
const express = require("express");                // Web framework
const exphbs = require("express-handlebars");      // Handlebars template engine
const fs = require("fs");                          // To read users.json
const path = require("path");                      // To work with paths
const session = require('express-session');        // load express-session
const randomstring = require('randomstring');      // load randomstring to generate session secret
const { MongoClient } = require("mongodb");
const libraryRoutes = require('./libraryRoutes');  // import routes for borrow/return


const app = express();


// Middleware to handle form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (like background.jpg)
app.use(express.static(path.join(__dirname, "public")));

// Set up Handlebars
app.engine("hbs", exphbs.engine({ 
    extname: ".hbs",
     defaultLayout: false,
     partialsDir: path.join(__dirname, "views/partials") // <-- tell handlebars where partials are
     }));
app.set("view engine", "hbs");

// Session setup
app.use(session({
    secret: randomstring.generate(),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3 * 60 * 1000 } // 3 minutes
}));

// Middleware to protect routes
function requireLogin(req, res, next) {
    if (!req.session.user) {      // check if no session exists
        return res.redirect('/'); // redirect to landing page
    }
    next(); // otherwise,allow to continue
}


// ========== ROUTES ========== //

app.use('/', libraryRoutes);   // use the router file for handling borrow/return


// Landing page
app.get("/", (req, res) => {
    res.render("landing", { loggedIn: false });  // No Sign Out on landing
});

// Sign in form
app.get("/signin", (req, res) => {
    res.render("signin", { message: null, loggedIn: false });  // Hide Sign Out
});

// Handle sign-in
app.post("/signin", (req, res) => {
    const { username, password } = req.body;  // get form data from request
    const users = JSON.parse(fs.readFileSync("users.json", "utf8")); // read users.json

    if (!users[username]) {
        return res.render("signin", { message: "Not a registered username", loggedIn: false }); 
    } else if (users[username] !== password) {
        return res.render("signin", { message: "Invalid password", loggedIn: false });
    } else {

        // create session and set user and sets cookie
        req.session.user = username;                 // create session and set user and sets cookie
        return res.redirect('/home'); // redirect to home after successful login
    }
});


// Home page (protected)
app.get('/home', requireLogin, async (req, res) => {
    const db = req.app.locals.db;

    try {
        const booksCollection = db.collection('books');
        const clientCollection = db.collection('clients');

        const allBooks = await booksCollection.find().toArray();
        const user = req.session.user;

        const client = await clientCollection.findOne({ Username: user });
        const borrowedIDs = client?.IDBooksBorrowed || [];

        const availableBooks = allBooks.filter(b => b.Available === true);
        const borrowedBooks = allBooks.filter(b => borrowedIDs.includes(b.ID));

        res.render('home', {
            user,
            loggedIn: true,
            availableBooks,
            borrowedBooks
        });

    } catch (err) {
        console.error("Error loading books from DB:", err);
        res.status(500).send("Server error");
    }
});






// Logout ,    Terminate session via distroy
app.get('/logout', (req, res) => {
    req.session.destroy(() => {                         /*  Terminate session via distroy	*/
        res.redirect('/');
    });
});

let db;

MongoClient.connect("mongodb+srv://masoumeh:HAmirSara3@cluster0.s2v1d.mongodb.net/library?retryWrites=true&w=majority&appName=Cluster0")
  .then(client => {
    db = client.db();
    app.locals.db = db;
    console.log(" Connected to MongoDB");
    
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err);
  });

  module.exports = app;



// Only start the server if this file is run directly (not when imported by Vercel)
if (require.main === module) {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Server running locally on http://localhost:${PORT}`);
    });
}

