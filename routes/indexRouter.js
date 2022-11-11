const express = require('express')
const router = express.Router()
const { MongoClient, ServerApiVersion } = require('mongodb');
const PDFDocument = require('pdfkit');
const axios = require('axios')
const dotenv = require('dotenv').config();


router.post('/', async (req, res, next) => {

  const startingRating = Number(req.body.startingRating)
  const maxRating = Number(req.body.maxRating)
  const amountOfPuzzles = Number(req.body.amountOfPuzzles)


  if (startingRating > maxRating) {
    res.render("index", { errorMsg: "The input might be incorrect, please try again :)" })
    
  }

  const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@cluster0.8jwuy6u.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


  client.connect( async function(err) {
    try {
      const collection = await client.db(`${process.env.DB_NAME}`).collection(`${process.env.COLLECTION_NAME}`);

      // In the "puzzles" variable we store all the puzzles extracted from the DB
      var puzzles = collection.aggregate([
        // Filter the results based on rating range provided by the user
        { 
          $match: { 
            rating: { 
              $gt: startingRating,
              $lt: maxRating
            } 
          } 
        },
        // Amount of puzzles you want to get
        { 
          $sample: { 
            size: amountOfPuzzles
          }
        }
      ]);

      // For async purposes, we must convert the CursorObject (puzzles) into an array inside an async function
      async function cursorToArr() {
        let arrOfPuzzles = await puzzles.toArray()
        return arrOfPuzzles
      }

      cursorToArr()
      .then(async arrOfPuzzles => {

        // Async function to update the FEN and convert the solution of the puzzle from the database
        async function updateAndConvertData(arr) {
          let arrOfPuzzlesUpdated = []

          arr.forEach(async puzzleObj => {
            // We call an API where we update the board and then convert the solution in UCI to a SAN format.
            await axios.post('http://127.0.0.1:8000/notation', {
              fen: puzzleObj.FEN,
              solution: puzzleObj.moves
            })
            .then(async function (convertionApiResponse) {
              // We call the fen2png API to convert our FEN into an image
              const response = await axios.get(`https://fen2png.com/api/?fen=${convertionApiResponse.data.updated_fen}&raw=true`,  { responseType: 'arraybuffer' })

              // Lichess returns a puzzle theme in camelCase (discoveredAttack).
              // For readability purposes we need to convert those strings to a more readable format (Discovered attack)

              // Create array of themes
              let themesArr = puzzleObj.themes.split(" ")
              // Get the first theme as string and convert it into an array
              let arrOfLetters = themesArr[0].split("")
              // Make all the letters in the array lowercase and then rejoin them as a string
              let lettersChanged = arrOfLetters.map(letter => letter == letter.toLowerCase() ? letter : " " + letter.toLowerCase())
              let finalStr = lettersChanged.join('')
              // Make the first letter of the string uppercase
              let uppercasedFinalStr = finalStr.charAt(0).toUpperCase() + finalStr.slice(1)

              // Store the updated and converted data inside an array
              arrOfPuzzlesUpdated.push({
                id: puzzleObj.puzzleId,
                updatedFEN: convertionApiResponse.data.updated_fen,
                moves: convertionApiResponse.data.converted_solution,
                bufferImg: response.data,
                rating: puzzleObj.rating,
                theme: uppercasedFinalStr,
                url: puzzleObj.gameUrl
              })

              // Return the updated array only when all the documents have been pushed.
              if (arrOfPuzzlesUpdated.length == req.body.amountOfPuzzles) {
                return arrOfPuzzlesUpdated
              }


            })
              // Finally, create the PDF
            .then(finalPuzzleData => { 
              if (finalPuzzleData !== undefined) {
                const pdfDoc = new PDFDocument({ size: "A4", layout: "landscape", autoFirstPage: false });
                let stream = pdfDoc.pipe(res)
                let counter = 0

                for (const puzz of finalPuzzleData) {
                  counter += 1
                  const puzzleImg = Buffer.from(puzz.bufferImg, "utf-8")
  
                  // PDF layout config:
                  pdfDoc.addPage()
                  
                  pdfDoc.image(puzzleImg, 80, 110, { width: 350 })
                  pdfDoc.fontSize(28);
                  pdfDoc.font('fonts/Merriweather-Regular.ttf')
                  .text(`${puzz.theme}`, 36, 36, { align: 'center', underline: true })
                  .text(`${puzz.rating}`, 36, 70, { align: 'center' })
                
                  // Convert the fen string into an array to check "b" or "w" element
                  let fenArray = puzz.updatedFEN.split(" ")
  
                  // Validation to write down who side has to move 
                  pdfDoc.fontSize(44)
                  fenArray[1] === "b" ? pdfDoc.text("Black to play", 480, 200) : pdfDoc.text("White to play", 480, 200)
                  
                  pdfDoc.fontSize(10)
                  pdfDoc.text(`Solution: ${puzz.moves}`, 0, 500, { align: 'right' })
        
                  pdfDoc.text(`Train in Lichess at: https://lichess.org/training/${puzz.id}`, 60, 480, { align: 'left' })
                  pdfDoc.text(`Check out the whole game: ${puzz.url}`, 60, 500, { align: 'left' })
        
                  // End the document creation process only after all the puzzles have been written onto the PDF
                  if (counter == req.body.amountOfPuzzles) {
                    pdfDoc.end()
                    
                    stream.on("finish", () => {
                      console.log("Process has finished :)")
                    })
                  }
                }
              }
            })
          })
        }

        updateAndConvertData(arrOfPuzzles)

      })

    } catch (error) {
      console.log(error)
    }
  })   
})




module.exports = router