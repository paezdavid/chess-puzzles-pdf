from typing import Union
from fastapi import FastAPI, Request
import chess

app = FastAPI()

@app.post("/notation")
async def convert(request: Request, fen: Union[str, None] = None, solution: Union[str, None] = None):
    
    # Convert the request body to JSON
    req_body_json = await request.json()
    # As the solution is a string, we convert it to a list so we can extract the first move
    solution_list = req_body_json["solution"].split()

    # Insert FEN. The FEN provided by Lichess is one move behind the actual puzzle.
    board = chess.Board(req_body_json["fen"])
    # Add the first move of the puzzle to update the FEN
    board.push(chess.Move.from_uci(solution_list[0]))
    # The FEN that we have after the puzzle has started:
    updated_fen = board.fen()
    # The solution of the puzzle after converting UCI to SAN.
    converted_solution = board.variation_san([chess.Move.from_uci(m) for m in solution_list[1:]])


    return { "updated_fen": updated_fen, "converted_solution": converted_solution }