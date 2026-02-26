use crate::{Coordinates, GameY};
use crate::bot::YBot;
use rand::seq::IteratorRandom;

pub struct HeuristicBot;

impl YBot for HeuristicBot {
    fn name(&self) -> &str {
        "heuristic_bot"
    }

    fn choose_move(&self, board: &GameY) -> Option<Coordinates> {
        let my_cells = board.available_cells();

        if my_cells.is_empty() {
            return None;
        }

        // gets the best cell iterating over all the available ones
        let best_cell = my_cells
            .iter()
            .max_by_key(|&&cell| self.evaluate_cell(board, cell as usize))
            .copied()?;

        let coordinates = Coordinates::from_index(best_cell, board.board_size());
        Some(coordinates)
    }
}

impl HeuristicBot {
    fn evaluate_cell(&self, board: &GameY, cell_index: usize) -> i32 {
        let board_size = board.board_size();
        let coords = Coordinates::from_index(cell_index as u32, board_size);

        let mut score = 0;

        // As closer to the center better
        let n = board_size as i32 - 1; // Maximum sum of coordinates

        let balance_score = 100 - (
            (coords.x() as i32 - coords.y() as i32).abs() +
                (coords.y() as i32 - coords.z() as i32).abs() +
                (coords.z() as i32 - coords.x() as i32).abs()
        ) * 2;

        score += balance_score.max(0);

        // Also prefer cells closer to the geometric center
        let target = (n as f32 / 3.0).round() as i32;
        let center_distance = (coords.x() as i32 - target).abs() +
            (coords.y() as i32 - target).abs() +
            (coords.z() as i32 - target).abs();

        score += (n * 3 - center_distance) * 3;

        // If it is connected to our pieces better
        let our_positions = board.get_player_positions_coords();
        for our_pos in &our_positions {  // Prestamo en lugar de mover
            let dist = board.manhattan_distance(coords, *our_pos);
            match dist {
                1 => score += 15,  // Adjacent to our pieces (very good)
                2 => score += 5,   // Two away (potential connection)
                _ => {}
            }
        }



        // If it blocks the opponent better
        let opponent_positions = board.get_opponent_positions_coords();
        for opp_pos in &opponent_positions {  // Prestamo en lugar de mover
            let dist = board.manhattan_distance(coords, *opp_pos);
            if dist == 1 {
                score += 8;  // Adjacent to opponent (good for blocking)
            } else if dist == 2 {
                score += 2;  // Close to opponent
            }
        }

        // Prefers the corners of the board or edge
        let sides_touched = [
            coords.touches_side_a(),
            coords.touches_side_b(),
            coords.touches_side_c()
        ].iter().filter(|&&b| b).count();

        match sides_touched {
            2 => score += 10,  // Corner (touches two sides) - increased bonus
            1 => score += 5,   // Edge (touches one side) - increased bonus
            _ => score += 0,   // Interior
        }

        // BONUS for cells that are part of potential winning lines
        // This is a simple check for lines of 2 in a row
        for our_pos in &our_positions {  // Prestamo, no movimiento
            let dist = board.manhattan_distance(coords, *our_pos);
            if dist == 1 {
                // Check if this would create a line of 2
                score += 5;
            }
        }

        // Penalize cells that are too close to opponent's clusters
        let mut opponent_threat = 0;
        for opp_pos in &opponent_positions {  // Prestamo, no movimiento
            let dist = board.manhattan_distance(coords, *opp_pos);
            if dist == 1 {
                opponent_threat += 3;
            }
        }
        // If there are multiple opponent pieces adjacent, it's dangerous
        if opponent_threat > 5 {
            score -= opponent_threat * 2;
        }

        score
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Movement, PlayerId};
    use std::collections::HashSet;

    // Helper function to create a game with some predefined moves
    fn create_test_game(size: u32, moves: Vec<(u32, u32, u32, u32)>) -> GameY {
        let mut game = GameY::new(size);
        for (player_x, player_y, player_z, player_id) in moves {
            let coords = Coordinates::new(player_x, player_y, player_z);
            let movement = Movement::Placement {
                player: PlayerId::new(player_id),
                coords,
            };
            game.add_move(movement).unwrap();
        }
        game
    }

    // Helper to get coordinates from indices
    fn coords_from_index(index: u32, board_size: u32) -> Coordinates {
        Coordinates::from_index(index, board_size)
    }

    #[test]
    fn test_heuristic_bot_name() {
        let bot = HeuristicBot;
        assert_eq!(bot.name(), "heuristic_bot");
    }

    #[test]
    fn test_choose_move_with_empty_board() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_some());

        let coords = chosen_move.unwrap();
        // Verify it's a valid coordinate within board bounds
        assert!(coords.x() < 3 && coords.y() < 3 && coords.z() < 3);
        assert_eq!(coords.x() + coords.y() + coords.z(), 2); // For size 3, sum should be 2
    }

    #[test]
    fn test_choose_move_with_no_available_cells() {
        let bot = HeuristicBot;
        let mut game = GameY::new(2);

        // Fill all cells (size 2 has 3 cells)
        let moves = vec![
            (1, 0, 0, 0), // Top
            (0, 1, 0, 1), // Left
            (0, 0, 1, 0), // Right
        ];

        for (x, y, z, player) in moves {
            let coords = Coordinates::new(x, y, z);
            let movement = Movement::Placement {
                player: PlayerId::new(player),
                coords,
            };
            game.add_move(movement).unwrap();
        }

        let chosen_move = bot.choose_move(&game);
        assert!(chosen_move.is_none());
    }

    #[test]
    fn test_evaluate_cell_adjacent_to_our_pieces() {
        let bot = HeuristicBot;

        // Create game with our piece at (2,0,0) and opponent at (0,2,0)
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Player 0's piece
            (0, 2, 0, 1), // Player 1's piece
        ]);

        // Evaluate cell adjacent to player 0's piece (2,0,0)
        let adjacent_to_player0 = Coordinates::new(1, 1, 0); // Adjacent to (2,0,0)
        let adjacent_idx = adjacent_to_player0.to_index(3) as usize;

        // Evaluate cell far from any pieces
        let far_cell = Coordinates::new(0, 0, 2); // Far corner
        let far_idx = far_cell.to_index(3) as usize;

        let adjacent_score = bot.evaluate_cell(&game, adjacent_idx);
        let far_score = bot.evaluate_cell(&game, far_idx);

        println!("Adjacent to player0 score: {}", adjacent_score);
        println!("Far cell score: {}", far_score);

        // The cell adjacent to any piece should have a bonus
        assert!(adjacent_score > far_score,
                "Adjacent to piece should have bonus ({} > {})",
                adjacent_score, far_score);
    }

    #[test]
    fn test_evaluate_cell_adjacent_to_opponent_pieces() {
        let bot = HeuristicBot;

        // Create game with our piece and opponent piece
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Player 0's piece
            (0, 2, 0, 1), // Player 1's piece
        ]);

        // Evaluate cell adjacent to player 1's piece (0,2,0)
        let adjacent_to_player1 = Coordinates::new(0, 1, 1); // Adjacent to (0,2,0)
        let adjacent_idx = adjacent_to_player1.to_index(3) as usize;

        // Evaluate cell far from opponent
        let far_cell = Coordinates::new(2, 0, 0); // Where player 0's piece is
        let far_idx = far_cell.to_index(3) as usize;

        let adjacent_score = bot.evaluate_cell(&game, adjacent_idx);
        let far_score = bot.evaluate_cell(&game, far_idx);

        println!("Adjacent to player1 score: {}", adjacent_score);
        println!("Far cell score: {}", far_score);

        // The cell adjacent to opponent should have blocking bonus
        assert!(adjacent_score > far_score,
                "Adjacent to opponent should have blocking bonus ({} > {})",
                adjacent_score, far_score);
    }

    #[test]
    fn test_evaluate_cell_distance_calculation() {
        let bot = HeuristicBot;
        let game = GameY::new(5);

        // Test cells at different distances from center
        let center_like = Coordinates::new(1, 1, 2); // Near center
        let mid_distance = Coordinates::new(2, 0, 2); // Mid-distance (edge)
        let far_corner = Coordinates::new(4, 0, 0); // Far corner

        let center_idx = center_like.to_index(5) as usize;
        let mid_idx = mid_distance.to_index(5) as usize;
        let far_idx = far_corner.to_index(5) as usize;

        let center_score = bot.evaluate_cell(&game, center_idx);
        let mid_score = bot.evaluate_cell(&game, mid_idx);
        let far_score = bot.evaluate_cell(&game, far_idx);

        println!("Center score: {}", center_score);
        println!("Mid score: {}", mid_score);
        println!("Far score: {}", far_score);

        // Center should be better than far corner
        assert!(center_score > far_score,
                "Center should score higher than far corner");

        // Center should be at least as good as mid
        assert!(center_score >= mid_score,
                "Center should score at least as high as mid-distance");
    }


    #[test]
    fn test_choose_move_selects_highest_scoring_cell() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        // Manually compute scores for all available cells
        let available: Vec<u32> = game.available_cells().iter().copied().collect();
        let scores: Vec<(u32, i32)> = available
            .iter()
            .map(|&cell| (cell, bot.evaluate_cell(&game, cell as usize)))
            .collect();

        // Print all scores for debugging
        for (cell, score) in &scores {
            let coords = coords_from_index(*cell, 3);
            println!("Cell {} ({:?}) score: {}", cell, coords, score);
        }

        // Find the cell with maximum score
        let (max_cell, max_score) = scores.iter()
            .max_by_key(|(_, score)| *score)
            .map(|(cell, score)| (*cell, *score))
            .unwrap();

        // Bot should choose that cell
        let chosen = bot.choose_move(&game).unwrap();
        let chosen_idx = chosen.to_index(3);

        assert_eq!(chosen_idx, max_cell,
                   "Bot should choose cell with highest score ({}, score={}) but chose {}",
                   max_cell, max_score, chosen_idx);
    }

    #[test]
    fn test_choose_move_with_complex_board_state() {
        let bot = HeuristicBot;

        // Create a more complex board state
        let game = create_test_game(4, vec![
            (3, 0, 0, 0), // Player 0 at top
            (2, 1, 0, 0), // Player 0
            (1, 1, 1, 0), // Player 0
            (0, 3, 0, 1), // Player 1 at left corner
            (0, 0, 3, 1), // Player 1 at right corner
        ]);

        let chosen = bot.choose_move(&game);
        assert!(chosen.is_some());

        let coords = chosen.unwrap();
        println!("Bot chose: {:?}", coords);

        // Verify it's a valid empty cell
        assert!(game.available_cells().contains(&coords.to_index(4)));
    }

    #[test]
    fn test_multiple_evaluations_consistency() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        // Evaluate same cell multiple times - should get same score
        let cell_idx = 2; // Some cell
        let score1 = bot.evaluate_cell(&game, cell_idx);
        let score2 = bot.evaluate_cell(&game, cell_idx);
        let score3 = bot.evaluate_cell(&game, cell_idx);

        assert_eq!(score1, score2);
        assert_eq!(score2, score3);
    }

    #[test]
    fn test_evaluate_cell_with_no_pieces() {
        let bot = HeuristicBot;
        let game = GameY::new(3);

        // All positions should evaluate without panicking
        for i in 0..game.total_cells() {
            let score = bot.evaluate_cell(&game, i as usize);
            // Score should be consistent
            assert!(score >= 0);
        }
    }

    #[test]
    fn test_manhattan_distance_consistency() {
        let game = GameY::new(5);

        let a = Coordinates::new(2, 1, 1);
        let b = Coordinates::new(2, 1, 1); // Same point

        // Distance to self should be 0
        assert_eq!(game.manhattan_distance(a, b), 0);

        // Test symmetry
        let c = Coordinates::new(4, 0, 0);
        let d = Coordinates::new(0, 2, 0);

        assert_eq!(game.manhattan_distance(c, d),
                   game.manhattan_distance(d, c));
    }

    #[test]
    fn test_get_player_positions_integration() {
        let game = create_test_game(3, vec![
            (2, 0, 0, 0), // Player 0
            (0, 2, 0, 1), // Player 1
        ]);

        let player_positions = game.get_player_positions_coords();
        let opponent_positions = game.get_opponent_positions_coords();

        println!("Player positions: {:?}", player_positions);
        println!("Opponent positions: {:?}", opponent_positions);

        // The union of both sets should contain all pieces
        let mut all_pieces = HashSet::new();
        all_pieces.extend(player_positions.iter().cloned());
        all_pieces.extend(opponent_positions.iter().cloned());

        assert_eq!(all_pieces.len(), 2, "Should have 2 total pieces");

        // Both pieces should be in the board
        assert!(all_pieces.contains(&Coordinates::new(2, 0, 0)));
        assert!(all_pieces.contains(&Coordinates::new(0, 2, 0)));

        // The two sets should be disjoint
        for pos in &player_positions {
            assert!(!opponent_positions.contains(pos),
                    "Player and opponent positions should be disjoint");
        }
    }
}
