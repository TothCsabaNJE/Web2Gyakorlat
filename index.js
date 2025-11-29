const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const express = require('express');
const app = express();
const mysql = require('mysql2');
const crypto = require('crypto');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

/*Mysql Express Session*/
app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: new MySQLStore({
        host: 'localhost',
        user: 'root',
        password: "",
        database: 'webgyakorlat'
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
    }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static('public'));
app.set("view engine", "ejs");

/*Mysql Connection*/
var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "webgyakorlat",
    multipleStatements: true
});
connection.connect((err) => {
    if (!err)
        console.log("Connected");
    else
        console.log("Conection Failed");
});


const customFields = {
    usernameField: 'uname',
    passwordField: 'pw',
};

/*Passport JS*/
const verifyCallback = (username, password, done) => {
    connection.query('SELECT * FROM users WHERE username = ? ', [username], function (error, results, fields) {
        if (error)
            return done(error);
        if (results.length == 0)
            return done(null, false);
        const isValid = validPassword(password, results[0].hash);
        user = { id: results[0].id, username: results[0].username, hash: results[0].hash };
        if (isValid)
            return done(null, user);
        else
            return done(null, false);
    });
}
function validPassword(password, hash) {
    return hash === crypto.createHash('sha512').update(password).digest('hex');
}

const strategy = new LocalStrategy(customFields, verifyCallback);
passport.use(strategy);

passport.serializeUser((user, done) => {
    console.log("inside serialize");
    done(null, user.id)
});

passport.deserializeUser(function (userId, done) {
    console.log('deserializeUser' + userId);
    connection.query('SELECT * FROM users where id = ?', [userId], function (error, results) {
        done(null, results[0]);
    });
});

app.use((req, res, next) => {
    console.log("\n" + req.url);
    console.log(req.session);
    console.log(req.user);
    next();
});

app.get('/', (req, res, next) => {
    auth = false
    username = ""
    admin = false
    if (req.isAuthenticated()) {
        auth = true
        username = req.user.username
    }
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true
    res.render("mainpage", {
        isAuth: auth, isAdmin: admin, username: username
    });
});

app.get('/register', (req, res, next) => {
    console.log("Inside get");
    res.render('register')
});

app.post('/register', userExists, (req, res, next) => {
    console.log("Inside post");
    console.log(req.body.pw);
    const hash = genPassword(req.body.pw);
    console.log(hash);
    connection.query('Insert into users(username,hash,isAdmin) values(?,?,0) ', [req.body.uname, hash], function (error, results, fields) {
        if (error)
            console.log("Error");
        else
            console.log("Successfully Entered");
    });
    res.redirect('/login');
});

function userExists(req, res, next) {
    connection.query('Select * from users where username=? ', [req.body.uname], function (error, results, fields) {
        if (error)
            console.log("Error");
        else if (results.length > 0)
            res.redirect('/userAlreadyExists')
        else
            next();
    });
}

app.get('/userAlreadyExists', (req, res, next) => {
    console.log("Inside get");
    res.send('<h1>Sorry This username is taken </h1><p><a href="/register">Register with different username</a></p>');
});

function genPassword(password) {
    return crypto.createHash('sha512').update(password).digest('hex');
}

function queryPromise(query, value) {
    return new Promise((resolve, reject) => {
        connection.query(query, value, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        })
    })
}

//Get all messages - REST API
app.get("/message-rest", async (req, res) => {
    try {
        const query = "SELECT * FROM messages";
        const result = await queryPromise(query);
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

//Get all db-appropriate data - REST API
app.get("/db-rest", async (req, res) => {
    try {
        const query = "SELECT * FROM kiosztas INNER JOIN telepules ON adohely=telepules.nev inner join regio ON telepules.megye=regio.megye;";
        const result = await queryPromise(query);
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

//Get specific kiosztas by id - REST API
app.get("/kiosztas/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const query = "SELECT * FROM kiosztas WHERE az=?";
        const result = await queryPromise(query, id);
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

//Add new kiosztas - REST API
app.post("/kiosztas", async (req, res) => {
    try {
        const value = req.body;
        const query = "INSERT INTO kiosztas SET?";
        const result = await queryPromise(query, value);
        res.status(201).json({ message: "Kiosztas added successfully" });
        console.log(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

//Update existing kiosztas by id - REST API
app.put("/kiosztas/:id", async (req, res) => {
    try {
        let id = req.params.id;
        const query = "UPDATE kiosztas SET ? WHERE az=?";
        const result = await queryPromise(query, [value, id]);
        res.status(202).json({ message: "Kiosztas updated successfully" });
        console.log(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

//Delete existing kiosztas by id - REST API
app.delete("/kiosztas/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const query = "DELETE FROM kiosztas WHERE az=?";
        const result = await queryPromise(query, id);
        res.status(200).json({ message: "Kiosztas deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.get('/login', (req, res, next) => {
    res.render('login')
});

app.post('/login', passport.authenticate('local', { failureRedirect: '/login-failure', successRedirect: '/login-success' }));

app.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

app.get('/login-success', (req, res, next) => {
    res.redirect('/protected-route');
});

app.get('/protected-route', isAuth, (req, res, next) => {
    admin = false
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true
    res.render("protected", {
        isAdmin: admin, username: req.user.username
    });
});

app.get('/db', isAuth, async (req, res, next) => {
    let admin = false;

    if (req.isAuthenticated && req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true;

    const search = req.query.q ? req.query.q.trim() : '';

    try {
        const db = connection.promise();

        let sql = 'SELECT * FROM kiosztas';
        let params = [];

        if (search) {
            sql += ' WHERE csatorna LIKE ? OR adohely LIKE ? OR cim LIKE ?';
            const like = '%' + search + '%';
            params = [like, like, like];
        }

        sql += ' ORDER BY az';

        const [rows] = await db.query(sql, params);

        res.render('db', {
            isAdmin: admin,
            username: req.user.username,
            records: rows,
            search: search
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
});

app.get('/contact', isAuth, (req, res, next) => {
    admin = false
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true
    res.render("contact", {
        isAdmin: admin, username: req.user.username
    });
});


//sending a message
app.post('/contact', (req, res, next) => {
    console.log("Inside post");
    const send = req.body.sender;
    const mes = req.body.message;
    connection.query('Insert into messages(sender,message) values(?,?)', [send, mes], function (error, results, fields) {
        if (error)
            console.log("Error");
        else
            console.log("Successfully Entered");
        res.redirect('/');
    });
})

app.get('/messages', isAuth, (req, res, next) => {
    admin = false;
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true
    res.render("messages", {
        isAdmin: admin, username: req.user.username
    });
});





function isAuth(req, res, next) {
    if (req.isAuthenticated())
        next();
    else
        res.redirect('/notAuthorized');
}

app.get('/notAuthorized', (req, res, next) => {
    console.log("Inside get");
    res.send('<h1>You are not authorized to view the resource </h1><p><a href="/login">Retry Login</a></p>');

});

app.get('/logout', function (req, res, next) {
    req.session.destroy(function (err) {
        res.clearCookie('session_cookie_name');
        res.redirect('/');
    });
});

app.get('/admin-route', isAdmin, (req, res, next) => {
    res.render("admin", {
        userName: req.user.username
    });
});

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin == 1)
        next();
    else
        res.redirect('/notAuthorizedAdmin');
}

app.get('/notAuthorizedAdmin', (req, res, next) => {
    console.log("Inside get");
    res.send('<h1>You are not authorized to view the resource as you are not the admin of the page  </h1><p><a href="/login">Retry to Login as admin</a></p>');

});

app.listen(3001, function () {
    console.log('App listening on port 3001!')
});
// LISTA (READ) – az összes rekord megjelenítése
app.get('/crud', isAuth, async (req, res, next) => {
    let admin = false;

    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true;

    try {
        const db = connection.promise();  // !!! promise wrapper
        const [rows] = await db.query('SELECT * FROM kiosztas ORDER BY az');

        res.render('crud', {
            isAdmin: admin,
            username: req.user.username,
            records: rows
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
});


// ÚJ REKORD ŰRLAP (CREATE – GET)
app.get('/crud/new', isAuth, async (req, res, next) => {
    let admin = false;

    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true;

    try {
        const db = connection.promise();
        const [telepulesek] = await db.query('SELECT nev FROM telepules ORDER BY nev');

        res.render('crud_new', {
            isAdmin: admin,
            username: req.user.username,
            telepulesek: telepulesek
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
});

// ÚJ REKORD FELVITELE (CREATE – POST)
app.post('/crud/new', isAuth, async (req, res, next) => {
    const { az, frekvencia, teljesitmeny, csatorna, adohely, cim } = req.body;

    try {
        const db = connection.promise();
        await db.query(
            'INSERT INTO kiosztas (az, frekvencia, teljesitmeny, csatorna, adohely, cim) VALUES (?, ?, ?, ?, ?, ?)',
            [az, frekvencia, teljesitmeny, csatorna, adohely, cim]
        );

        res.redirect('/crud');
    } catch (err) {
        console.error(err);
        next(err);
    }
});


// MÓDOSÍTÁS ŰRLAP (UPDATE – GET)
app.get('/crud/edit/:az', isAuth, async (req, res, next) => {
    const az = req.params.az;
    let admin = false;

    if (req.isAuthenticated() && req.user.isAdmin == 1)
        admin = true;

    try {
        const db = connection.promise();

        const [rows] = await db.query('SELECT * FROM kiosztas WHERE az = ?', [az]);
        if (rows.length === 0) {
            return res.status(404).send('Nincs ilyen rekord');
        }

        const [telepulesek] = await db.query('SELECT nev FROM telepules ORDER BY nev');

        res.render('crud_edit', {
            isAdmin: admin,
            username: req.user.username,
            record: rows[0],
            telepulesek: telepulesek
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
});

// MÓDOSÍTÁS MENTÉSE (UPDATE – POST)
app.post('/crud/edit/:az', isAuth, async (req, res, next) => {
    const az = req.params.az;
    const { frekvencia, teljesitmeny, csatorna, adohely, cim } = req.body;

    try {
        const db = connection.promise();
        await db.query(
            'UPDATE kiosztas SET frekvencia = ?, teljesitmeny = ?, csatorna = ?, adohely = ?, cim = ? WHERE az = ?',
            [frekvencia, teljesitmeny, csatorna, adohely, cim, az]
        );

        res.redirect('/crud');
    } catch (err) {
        console.error(err);
        next(err);
    }
});


// TÖRLÉS (DELETE – POST)
app.post('/crud/delete/:az', isAuth, async (req, res, next) => {
    const az = req.params.az;

    try {
        const db = connection.promise();
        await db.query('DELETE FROM kiosztas WHERE az = ?', [az]);

        res.redirect('/crud');
    } catch (err) {
        console.error(err);
        next(err);
    }
});
