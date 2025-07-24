const express = require('express');             // load express
const router = express.Router();                // create a router object

// Middleware: check if user is logged in
function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/');
    next();
}

//  Borrow books
router.post('/borrow', requireLogin, async (req, res) => {
    const db = req.app.locals.db;                          // get MongoDB connection
    const booksCollection = db.collection('books');        // get books collection
    const clientsCollection = db.collection('clients');    // get clients collection
    const user = req.session.user;                         // current logged-in user
    let selectedBooks = req.body.books;

    if (!selectedBooks) return res.redirect('/home');
    if (!Array.isArray(selectedBooks)) selectedBooks = [selectedBooks];

    // Get client's record
    const client = await clientsCollection.findOne({ Username: user });
    if (!client) return res.redirect('/home');

    const updatedIDs = [];

    for (let bookID of selectedBooks) {
        const numericID = parseInt(bookID);
        const book = await booksCollection.findOne({ ID: numericID });

        if (book && book.Available === true) {
            // Update book as unavailable
            await booksCollection.updateOne({ ID: numericID }, { $set: { Available: false } });
            updatedIDs.push(numericID);
        }
    }

    // Add borrowed books to client's list
    await clientsCollection.updateOne(
        { Username: user },
        { $addToSet: { IDBooksBorrowed: { $each: updatedIDs } } }
    );

    res.redirect('/home');
});

//  Return books
router.post('/return', requireLogin, async (req, res) => {
    const db = req.app.locals.db;
    const booksCollection = db.collection('books');
    const clientsCollection = db.collection('clients');
    const user = req.session.user;
    let selectedBooks = req.body.books;

    if (!selectedBooks) return res.redirect('/home');
    if (!Array.isArray(selectedBooks)) selectedBooks = [selectedBooks];

    const updatedIDs = [];

    for (let bookID of selectedBooks) {
        const numericID = parseInt(bookID);

        // Update book to Available
        await booksCollection.updateOne({ ID: numericID }, { $set: { Available: true } });
        updatedIDs.push(numericID);
    }

    // Remove book IDs from client's borrowed list
    await clientsCollection.updateOne(
        { Username: user },
        { $pull: { IDBooksBorrowed: { $in: updatedIDs } } }
    );

    res.redirect('/home');
});

module.exports = router;
