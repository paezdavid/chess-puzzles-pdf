const express = require('express')
const router = express.Router()
const { MongoClient, ServerApiVersion } = require('mongodb');
const PDFDocument = require('pdfkit');
const axios = require('axios')
const fs = require('fs')
const dotenv = require('dotenv').config();


async function createPDF(FEN, rating, themes, solution) {
  // We call an API where we update the board and then convert the solution in UCI to a SAN format.
  axios.post('http://127.0.0.1:8000/notation', {
    fen: FEN,
    solution: solution
  })
    .then(async function (res) {
      // We call the fen2png API to convert our FEN into an image
      const response = await axios.get(`https://fen2png.com/api/?fen=${res.data.updated_fen}&raw=true`,  { responseType: 'arraybuffer' })
      const buffer = Buffer.from(response.data, "utf-8")

      // Lichess returns a puzzle theme in camelCase (discoveredAttack).
      // For readability purposes we need to convert those strings to a more readable format (Discovered attack)

      // Create array of themes
      let themesArr = themes.split(" ")
      // Get the first theme as string and convert it into an array
      let arrOfLetters = themesArr[0].split("")
      // Make all the letters in the array lowercase and then rejoin them as a string
      let lettersChanged = arrOfLetters.map(letter => letter == letter.toLowerCase() ? letter : " " + letter.toLowerCase())
      let finalStr = lettersChanged.join('')
      // Make the first letter of the string uppercase
      let uppercasedFinalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1)

      // Convert the fen string into an array to check "b" or "w" element
      let fenArray = res.data.updated_fen.split(" ")
      
      // PDF layout config:
      const docx = new PDFDocument({ size: "A4", layout: "landscape" });
      docx.pipe(fs.createWriteStream(`documento.pdf`));
      // docx.rect(0, 0, docx.page.width, docx.page.height).fill('#FFE47F');
      docx.image(buffer, 42, 90, { width: 350 })
      docx.fontSize(20);
      docx.font('Helvetica')
        .text(`${uppercasedFinalStr}`, 36, 36, { align: 'center' })
        .text(`${rating}`, 36, 66, { align: 'center' })

      // Validation to write down who side has to move 
      fenArray[1] === "b" ? docx.text("Black to play", 550, 100) : docx.text("White to play", 550, 100)

      docx.end()


      
      console.log("Done! ")
    })
    .catch(function (error) {
      console.log("ERROR: ", error);
    });

}


router.post('/', async (req, res) => {
  // console.log(req.body.startingRating)
  // console.log(req.body.maxRating)
  
  let iterationNumber = 0

  const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@cluster0.8jwuy6u.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  client.connect( async function(err) {
    try {
      const collection = await client.db(`${process.env.DB_NAME}`).collection(`${process.env.COLLECTION_NAME}`);

      // In the "puzzles" variable we store all the puzzles extracted from the DB
      const puzzles = collection.aggregate([
        // Filter the results based on rating range provided by the user
        { 
          $match: { 
            rating: { 
              $gt: parseInt(req.body.startingRating), 
              $lt: parseInt(req.body.maxRating) 
            } 
          } 
        },
        // Amount of puzzles you want to get
        { 
          $sample: { 
            size: parseInt(req.body.amountOfPuzzles) 
          }
        }
      ]);

      // For each puzzle we call the createPDF() function
      await puzzles.forEach((puzzleObj) => {
        createPDF(puzzleObj.FEN, puzzleObj.rating, puzzleObj.themes, puzzleObj.moves)

        console.log(iterationNumber)
        iterationNumber++

      })

    } finally {
      console.log("nice")
      res.redirect('/')
    }
  
  })

})



module.exports = router