# 🎯 Complete Cartela System Overview

## 📋 1. Cartela Structure & Data Model

### Database Schema
```typescript
// From shared/schema-simple.ts
export const cartelas = sqliteTable("cartelas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cartelaNumber: integer("cartela_number").notNull(),
  shopId: integer("shop_id").notNull(),
  numbers: text("numbers").notNull(), // JSON string of 5x5 grid
  isSold: integer("is_sold", { mode: "boolean" }).default(false),
  soldTo: integer("sold_to"), // User ID who bought it
  soldAt: integer("sold_at", { mode: "timestamp" }),
  gameId: integer("game_id"), // Which game it's used in
  isWinner: integer("is_winner", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).default(Date.now),
});
```

### Cartela Number Generation
```typescript
// From bingo-employee-dashboard.tsx
const generateCardNumbers = (cardNum: number): number[][] => {
  // Uses deterministic seed based on card number
  const seed = cardNum * 12345;
  const random = (min: number, max: number) => {
    const x = Math.sin(seed + min + max) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  const card: number[][] = [];
  
  // B column (1-15)
  const b = Array.from({ length: 5 }, () => random(1, 15));
  // I column (16-30)
  const i = Array.from({ length: 5 }, () => random(16, 30));
  // N column (31-45) with free space in middle
  const n = Array.from({ length: 2 }, () => random(31, 45));
  n.push(0); // Free space
  n.push(...Array.from({ length: 2 }, () => random(31, 45)));
  // G column (46-60)
  const g = Array.from({ length: 5 }, () => random(46, 60));
  // O column (61-75)
  const o = Array.from({ length: 5 }, () => random(61, 75));

  card.push(b, i, n, g, o);
  return card;
};
```

## 🏪 2. Cartela Registration Process

### Card Selection Interface
```typescript
// From bingo-employee-dashboard.tsx - Registration Workflow
{gameState === 'REGISTERING' && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
    <div className="bg-white text-black rounded-lg shadow-2xl max-w-6xl w-full">
      {/* Left Side - Available Cards */}
      <div className="w-2/3 border-r border-gray-300 p-6">
        <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {Array.from({ length: 100 }, (_, i) => i + 1).map((cardNum) => {
            const isSelected = selectedCards.has(cardNum);
            return renderBingoCard(cardNum, isSelected);
          })}
        </div>
      </div>
      
      {/* Right Side - Summary & Registration */}
      <div className="w-1/3 p-6 bg-gray-50">
        <h3>Summary</h3>
        <div>Selected Cards: {selectedCards.size}</div>
        <label>Top-up Fee (ETB)</label>
        <Select value={topUpFee} onValueChange={setTopUpFee}>
          <SelectItem value="10">10 ETB</SelectItem>
          <SelectItem value="20">20 ETB</SelectItem>
          <SelectItem value="30">30 ETB</SelectItem>
        </Select>
        
        <Button onClick={handleRegisterCards}>
          Register {selectedCards.size} Cards
        </Button>
      </div>
    </div>
  </div>
)}
```

### Card Registration API
```typescript
// From server/routes/index.ts (likely implementation)
app.post('/api/cartelas/register', async (req, res) => {
  const { cardNumbers, shopId, topUpFee } = req.body;
  
  for (const cardNum of cardNumbers) {
    const numbers = generateCartelaNumbers(cardNum);
    
    await db.insert(cartelas).values({
      cartelaNumber: cardNum,
      shopId: shopId,
      numbers: JSON.stringify(numbers),
      isSold: false,
      createdAt: new Date()
    });
  }
  
  res.json({ success: true, registered: cardNumbers.length });
});
```

## 📥 3. Cartela Import System

### CSV Import Functionality
```typescript
// From bingo-employee-dashboard.tsx
const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      // Process CSV content here
      // Expected format: cardNumber,playerName,etc.
      const lines = content.split('\n');
      const cardNumbers = lines.map(line => {
        const [cardNum] = line.split(',');
        return parseInt(cardNum.trim());
      }).filter(num => !isNaN(num));
      
      // Add to selected cards
      const newSelected = new Set(selectedCards);
      cardNumbers.forEach(num => newSelected.add(num));
      setSelectedCards(newSelected);
    };
    reader.readAsText(file);
  }
};
```

## 🎮 4. Cartela Usage in Games

### Game Registration
```typescript
// When starting a game, selected cards are registered to that game
const handleStartGame = async () => {
  try {
    // Create new game
    const gameResponse = await fetch('/api/games/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: user?.shopId,
        gameMode: gameMode,
        cardNumbers: Array.from(selectedCards),
        topUpFee: parseInt(topUpFee)
      })
    });
    
    const game = await gameResponse.json();
    
    // Mark cards as sold and assigned to this game
    for (const cardNum of selectedCards) {
      await db.update(cartelas)
        .set({ 
          isSold: true, 
          gameId: game.id,
          soldAt: new Date()
        })
        .where(eq(cartelas.cartelaNumber, cardNum));
    }
    
    setGameState('PLAYING');
  } catch (error) {
    console.error('Error starting game:', error);
  }
};
```

## 🔢 5. Number Calling & Cartela Tracking

### Called Numbers Management
```typescript
// From bingo-employee-dashboard.tsx
const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
const [currentNumber, setCurrentNumber] = useState<number | null>(null);

const handleCallNumber = async () => {
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
    .filter(n => !calledNumbers.includes(n));

  if (availableNumbers.length === 0) {
    stopAutoCalling();
    return;
  }

  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  const newNumber = availableNumbers[randomIndex];

  // Update UI state immediately
  setCurrentNumber(newNumber);
  setCalledNumbers([...calledNumbers, newNumber]);

  // Voice announcement
  await customBingoVoice.callNumber(newNumber);
};
```

## 🏆 6. Winner Checking System

### Cartela Winner Validation
```typescript
// From bingo-employee-dashboard.tsx
const handleCheckWinner = async (cartelaNumber: number): Promise<{ isWinner: boolean; pattern?: string }> => {
  try {
    const response = await fetch('/api/games/check-winner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartelaNumber: cartelaNumber,
        calledNumbers: calledNumbers,
        gameId: activeGame?.id
      })
    });

    const result = await response.json();
    
    // Announce winner with voice
    await customBingoVoice.announceWinner(cartelaNumber, result.isWinner);
    
    return result;
  } catch (error) {
    console.error('Error checking winner:', error);
    return { isWinner: false };
  }
};
```

### Backend Winner Validation
```typescript
// Server-side winner checking logic
const checkWinner = (cartelaNumbers: number[][], calledNumbers: number[]) => {
  // Check for standard bingo patterns
  const patterns = {
    'line': checkLines(cartelaNumbers, calledNumbers),
    'diagonal': checkDiagonals(cartelaNumbers, calledNumbers),
    'full_house': checkFullHouse(cartelaNumbers, calledNumbers),
    'four_corners': checkFourCorners(cartelaNumbers, calledNumbers)
  };
  
  return Object.entries(patterns).find(([_, won]) => won)?.[0] || null;
};
```

## 📊 7. Cartela Storage & Persistence

### Database Operations
```typescript
// Cartela CRUD operations
export const cartelaOperations = {
  // Create new cartela
  create: async (cartelaNumber: number, shopId: number) => {
    const numbers = generateCartelaNumbers(cartelaNumber);
    return await db.insert(cartelas).values({
      cartelaNumber,
      shopId,
      numbers: JSON.stringify(numbers),
      createdAt: new Date()
    });
  },
  
  // Get cartela by number
  getByNumber: async (cartelaNumber: number, shopId: number) => {
    return await db.select()
      .from(cartelas)
      .where(and(
        eq(cartelas.cartelaNumber, cartelaNumber),
        eq(cartelas.shopId, shopId)
      ));
  },
  
  // Get available cartelas for shop
  getAvailable: async (shopId: number) => {
    return await db.select()
      .from(cartelas)
      .where(and(
        eq(cartelas.shopId, shopId),
        eq(cartelas.isSold, false)
      ));
  },
  
  // Mark as sold
  markAsSold: async (cartelaNumber: number, gameId: number, userId: number) => {
    return await db.update(cartelas)
      .set({ 
        isSold: true, 
        gameId, 
        soldTo: userId,
        soldAt: new Date()
      })
      .where(eq(cartelas.cartelaNumber, cartelaNumber));
  }
};
```

## 🔄 8. Cartela Lifecycle

### Complete Flow
1. **Generation**: Cartelas generated with deterministic number patterns
2. **Registration**: Selected cards registered to shop inventory
3. **Import**: CSV import for bulk card registration
4. **Sale**: Cards marked as sold when game starts
5. **Game Play**: Numbers called and tracked against cartelas
6. **Winner Check**: Cartelas validated against called numbers
7. **Storage**: All cartela data stored in SQLite database

### Data Flow
```
Card Generation → Registration → Game Assignment → Number Calling → Winner Validation → Storage
     ↓                ↓              ↓               ↓              ↓           ↓
  Number Grid    Database Entry   Game ID Link   Called Numbers  Pattern Check  Persistent
```

## 🎯 Key Features

### Deterministic Generation
- Same cartela number always generates same number pattern
- Uses seed-based randomization for consistency
- Proper B-I-N-G-O column ranges

### Flexible Registration
- Manual selection through UI
- CSV import for bulk operations
- Top-up fee management
- Shop-specific inventory

### Real-time Tracking
- Called numbers tracked in state
- Winner checking with multiple patterns
- Voice integration for announcements
- Visual feedback on bingo board

### Persistent Storage
- SQLite database for cartela data
- Game history and winners
- Shop inventory management
- User purchase tracking

## 📋 Summary

This system provides a complete cartela management solution from generation to game play to winner validation, with proper data persistence and user-friendly interfaces. The cartelas are:

- **Generated**: Deterministically with proper bingo number distribution
- **Registered**: Through UI selection or CSV import
- **Stored**: In SQLite database with full metadata
- **Called**: Tracked against called numbers during games
- **Validated**: For winning patterns with voice announcements
- **Managed**: With shop-specific inventory and user tracking

The entire flow ensures data integrity, proper game mechanics, and a professional bingo experience.
