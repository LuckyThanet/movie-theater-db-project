const mysql = require("mysql2");
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const Path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 2000;

app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "phile_theatre",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to database");
});

const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  console.log("in authenticateToken = ", token);
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, "your_secret_key", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authenticateTokenForAdmin = async (req, res, next) => {
  const token = req.headers["authorization"];
  console.log("authenticateTokenForAdmin =>", token);
  if (!token) return res.status(200).json({ error: "Invalid password" });
  try {
    const result = await new Promise((resolve, reject) => {
      let sqlQuery = "SELECT staff_name FROM staff_tb";
      db.query(sqlQuery, (err, rows) => {
        if (err) {
          console.error("Error fetching data:", err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
    jwt.verify(token, "your_secret_key", (err, user) => {
      if (err) return res.sendStatus(403);
      const found = result.some((row) => row.staff_name === user.username);
      if (found) {
        req.user = user;
        next();
      } else {
        req.user = user;
        res.status(200).json({ error: "Invalid password", user });
        return;
      }
    });
  } catch (error) {
    console.error("An error occurred while authenticating token:", error);
    res
      .status(500)
      .json({ error: "An error occurred while authenticating token" });
  }
};

app.get("/theater", authenticateTokenForAdmin, (req, res) => {
  res.json({ message: "onlyfan" });
});

app.post("/", authenticateToken, (req, res) => {
  console.log(req);
});

app.post("/login/theater", (req, res) => {
  // for admin
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  const { username, password } = req.body;
  console.log("in admin function", req.body);
  // Check if username or password is missing
  if (!username || !password) {
    return res.status(400).json({ error: "Username or password is missing" });
  }

  let sqlQuery =
    "SELECT staff_name, staff_pass FROM staff_tb WHERE staff_name = ?";
  db.query(sqlQuery, [username], (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res
        .status(500)
        .json({ error: "An error occurred while fetching data" });
    }
    if (result.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isPasswordValid = password === result[0].staff_pass;
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    console.log(result);
    const token = jwt.sign(
      { username: result[0].staff_name },
      "your_secret_key"
    );
    res.json({ token });
  });
});

app.post("/upload", upload.single("userimg"), (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  console.log(req.file);
  console.log(req.body.username);
  let path = "uploads/";
  let originalname = `${path}${req.file.originalname}`;
  let newname = `${path}${req.body.username}-picture.png`;

  fs.rename(originalname, newname, (err) => {
    if (err) {
      console.error("Error renaming file:", err);
    } else {
      console.log("File renamed successfully!");
    }
  });
  res.json({ message: "File uploaded successfully." });
});

app.post("/register", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let path = "uploads/";
  const formData = req.body;
  let user_img = `${path}${formData.username}-picture.png`;
  console.log(formData);
  try {
    const sqlQuery =
      "INSERT INTO member_tb (  user_name , user_mail, user_pass ,rank_id, user_img) VALUES (?, ?, ?, ?, ?)";
    const hashedPassword = await bcrypt.hash(formData.password, 1);
    const values = [
      formData.username,
      formData.email,
      hashedPassword,
      0,
      user_img,
    ];
    db.query(sqlQuery, values, (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        res
          .status(500)
          .json({ error: "An error occurred while inserting data" });
        return;
      }
      console.log("Data inserted successfully");
      res.send("Data received and inserted successfully!");
    });
  } catch (error) {
    console.error("Registration failed:", error);
    res.status(500).json({ message: "Error registering user" });
  }
});

app.post("/api/login", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  const { username, password } = req.body;
  console.log(req.body);
  let sqlQuery = `SELECT user_name, user_pass FROM member_tb WHERE user_name LIKE '${username}'` ;
  db.query(sqlQuery, async (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    console.log(result);
    const isPasswordValid = await bcrypt.compare(password, result[0].user_pass);
    if (!isPasswordValid) {
      // res.status(401).json({ error: 'Invalid password' });
      res.status(200).json({ error: "Invalid password" });
      return;
    }
    const token = jwt.sign(
      { username: result[0].user_name },
      "your_secret_key"
    );
    res.json({ token });
  });
});

app.get("/api/db", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  db.query(sql2, (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    res.json(result);
  });
});

app.get("/api/data", authenticateToken, (req, res) => {
  console.log(req.user);
  let sqlQuery = `SELECT user_img FROM users_tb WHERE user_name = ?;`;
  db.query(sqlQuery, [req.user.username], (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    // res.json(result);
    console.log(result);
    res.json({
      message: "Hello from Express!",
      user: req.user,
      result: result,
    });
  });
});

app.get("/api/showtime", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let sqlQuery = "SELECT start_time FROM showtime_tb";
  db.query(sqlQuery, (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    const getTime = {};
    result.forEach((item) => {
      const date = item.start_time.split(" ")[0];
      const time = item.start_time.split(" ")[1];
      if (!getTime[date]) {
        getTime[date] = [];
      }
      getTime[date].push(time);
    });
    res.json(getTime);
  });
});

app.get("/api/movie", (req, res) => {
  //1
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let sqlQuery = `SELECT showtime_tb.theatre_id , showtime_tb.start_time , movie_tb.mov_name , movie_tb.mov_img ,movie_tb.mov_price , movie_tb.mov_trailer , movie_tb.mov_des ,movie_tb.time_show ,movie_tb.mov_date FROM showtime_tb JOIN movie_tb ON showtime_tb.mov_id = movie_tb.mov_id`;
  db.query(sqlQuery, (err, movieSchedule) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    console.log(movieSchedule);
    const organizedSchedule = {};

    // Loop through each movie schedule
    movieSchedule.forEach((schedule) => {
      // If the movie name does not exist in the organized schedule, create an entry
      if (!organizedSchedule[schedule.mov_name]) {
        // Create an object to hold the movie details including mov_img
        organizedSchedule[schedule.mov_name] = {
          mov_img: schedule.mov_img,
          mov_price: schedule.mov_price,
          mov_date: schedule.mov_date,
          mov_trailer: schedule.mov_trailer,
          mov_des: schedule.mov_des,
          time_show: schedule.time_show,
          // mov_trailer: "sadsd",
          schedules: {},
        };
      }

      // If the theater ID does not exist for this movie, create an entry
      if (
        !organizedSchedule[schedule.mov_name].schedules[schedule.theatre_id]
      ) {
        organizedSchedule[schedule.mov_name].schedules[schedule.theatre_id] =
          [];
      }

      // Push the start time into the appropriate theater ID array
      organizedSchedule[schedule.mov_name].schedules[schedule.theatre_id].push(
        schedule.start_time
      );
    });

    // Iterate through each movie in the organized schedule
    Object.keys(organizedSchedule).forEach((movieName) => {
      // Iterate through each theater for the current movie
      Object.keys(organizedSchedule[movieName].schedules).forEach(
        (theaterId) => {
          const theaterSchedule =
            organizedSchedule[movieName].schedules[theaterId];
          const dateDict = {};
          // Loop through each start time in the theater schedule
          theaterSchedule.forEach((startTime) => {
            const [date, time] = startTime.split(" ");
            // If the date does not exist in the dateDict, create an entry
            if (!dateDict[date]) {
              dateDict[date] = [];
            }

            // Push the time into the array corresponding to its date
            dateDict[date].push(time);
          });
          // Replace the theater schedule with the organized schedule by date
          organizedSchedule[movieName].schedules[theaterId] = dateDict;
        }
      );
    });
    res.json(organizedSchedule);
  });
});

app.post("/sendSelectMovie", (req, res) => {
  //2
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let sqlQuery = `SELECT
  seat_tb.seat_name
FROM
  booking_tb
JOIN showtime_tb ON booking_tb.show_id = showtime_tb.show_id
JOIN movie_tb ON showtime_tb.mov_id = movie_tb.mov_id
JOIN seat_tb ON booking_tb.seat_id = seat_tb.seat_id
JOIN theatre_tb ON showtime_tb.theatre_id = theatre_tb.theatre_id
WHERE movie_tb.mov_name = ? AND showtime_tb.start_time = ? AND theatre_tb.theatre_id = ?`;
  const send = req.body;
  console.log(send);
  db.query(
    sqlQuery,
    [send.movie, `${send.date} ${send.time}`, send.theater],
    (err, query) => {
      if (err) {
        console.error("Error fetching data:", err);
        res
          .status(500)
          .json({ error: "An error occurred while fetching data" });
        return;
      }
      const result = query.reduce((acc, seat) => {
        // Extract the row letter and seat number
        const rowLetter = seat.seat_name[0];
        const seatNumber = parseInt(seat.seat_name.slice(1), 10) - 1;

        // Convert the row letter to a numeric key (G -> 0, F -> 1, ..., A -> 6)
        const rowKey = "G".charCodeAt(0) - rowLetter.charCodeAt(0);

        // Initialize the array if it doesn't exist yet
        if (!acc[rowKey]) {
          acc[rowKey] = [];
        }

        acc[rowKey].push(seatNumber);

        return acc;
      }, {});
      Object.keys(result).forEach((key) => {
        result[key].sort((a, b) => a - b);
      });

      const sortedResult = Object.keys(result)
        .sort((a, b) => a - b)
        .reduce((acc, key) => {
          acc[key] = result[key];
          return acc;
        }, {});
      console.log(sortedResult);
      res.json(sortedResult);
    }
  );
});

app.post("/api/booking", authenticateToken, (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  const dataSet = req.body;
  const user = req.user;
  console.log(req.body);
  console.log(req.user);
  let sqlQuery = `INSERT INTO booking_tb (show_id, user_id, seat_id, total_price, booked_time) VALUES`;
  dataSet.position.forEach((position, index) => {
    if (index !== 0) {
      sqlQuery += ",";
    }

    sqlQuery +=  (`
      (SELECT st.show_id FROM showtime_tb st 
       JOIN movie_tb m ON st.mov_id = m.mov_id 
       WHERE st.start_time = '${dataSet.dataSeatTime}'
       AND m.mov_name = '${dataSet.moviename}'),
      (SELECT user_id FROM member_tb WHERE user_name = '${user.username}'),
      (SELECT seat_id FROM seat_tb WHERE seat_name = '${position}'  AND theatre_id =${dataSet.theatre}),
      ${dataSet.price},
      '${dataSet.timestamp}'
    `);
  });
  db.query(sqlQuery, (err, query) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
  });
});

app.get("/api/profile1", authenticateToken, (req, res) => {
  console.log(req.user);
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let sqlQuery = `SELECT user_name , user_mail , user_img FROM member_tb WHERE user_name = ?`;
  db.query(sqlQuery, [req.user.username], (err, query) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    console.log(query);
    res.json(query[0]);
  });
});

app.get("/api/profile2", authenticateToken, (req, res) => {
  //3
  console.log(req.user);
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  let sqlQuery = `SELECT movie_tb.mov_name , movie_tb.mov_img , showtime_tb.start_time 
  FROM booking_tb
  JOIN member_tb ON booking_tb.user_id = member_tb.user_id
  JOIN seat_tb ON booking_tb.seat_id = seat_tb.seat_id
  JOIN showtime_tb ON booking_tb.show_id = showtime_tb.show_id
  JOIN movie_tb ON showtime_tb.mov_id = movie_tb.mov_id 
  WHERE member_tb.user_name = ?`;
  db.query(sqlQuery, [req.user.username], (err, query) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    console.log(query);
    res.json({ data: query });
  });
});



app.post("/movie/add", authenticateTokenForAdmin, (req, res) => {
  console.log(req.body);
  let data = req.body;
  let dataQuery = [
    data["mov_name"],
    data["mov_price"],
    data["mov_date"],
    data["time_show"],
    data["mov_img"],
    data["mov_trailer"],
    data["mov_des"],
  ];
  let sqlQuery = `INSERT INTO movie_tb (mov_name, mov_price, mov_date, time_show, mov_img, mov_trailer, mov_des) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sqlQuery, dataQuery, (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    res.status(200).json({ message1: true });
  });
});

app.post("/movie/add2", authenticateTokenForAdmin, (req, res) => {
  // console.log(req.body);
  const movieData = req.body;
  let sqlString =
    "INSERT INTO showtime_tb (mov_id, start_time, staff_id, theatre_id) VALUES\n";
  let isFirst = true;
  for (const date in movieData.schedules) {
    const times = movieData.schedules[date];
    times.forEach((time) => {
      if (time !== "") {
        if (!isFirst) {
          sqlString += ",\n";
        }
        sqlString +=   `((SELECT mov_id FROM movie_tb WHERE mov_name = '${movieData.mov_title}'), '${date} ${time}', (SELECT staff_id FROM staff_tb WHERE staff_name = '${movieData.staff_name}'), ${movieData.theater})`;
        isFirst = false;
      }
    });
  }
  db.query(sqlString, (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    res.status(200).json({ message2: true });
  });
});

app.post("/movie/edit", authenticateTokenForAdmin, (req, res) => {
  console.log(req.body);
  const movieData = req.body;
  let dataQuery = [
    movieData["mov_price"],
    movieData["mov_date"],
    movieData["time_show"],
    movieData["mov_img"],
    movieData["mov_trailer"],
    movieData["mov_des"],
    movieData["mov_name"] 
  ];
  let sqlQuery = `UPDATE movie_tb
  SET mov_price = ?,
      mov_date = ?,
      time_show = ?,
      mov_img = ?,
      mov_trailer = ?,
      mov_des = ?
  WHERE mov_name = ?`; 
  db.query(sqlQuery, dataQuery, (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).json({ error: "An error occurred while fetching data" });
      return;
    }
    res.status(200).json({ message1: true });
  });
});


app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});