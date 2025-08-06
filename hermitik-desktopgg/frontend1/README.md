# Hermetik Cryptocurrency Portfolio Dashboard

A modern React-based cryptocurrency portfolio dashboard for tracking DeFi portfolios across multiple wallets and chains.

## Features

- **Multi-wallet Portfolio Tracking**: Track tokens and DeFi positions across multiple Ethereum addresses
- **Real-time Data**: Auto-refreshing portfolio data with live price updates
- **Multi-chain Support**: Ethereum, BSC, Arbitrum, Polygon, Base, and Optimism
- **DeFi Protocol Integration**: Track positions in Uniswap, Aave, Compound, PancakeSwap, GMX, and more
- **Advanced Analytics**: Portfolio performance metrics, historical charts, and risk analysis
- **Professional UI**: Dark-themed, responsive design with smooth animations
- **Data Export**: Excel export functionality for detailed portfolio reporting

## Test Users & Demo Data

The application includes comprehensive test data for demonstration purposes:

### Test Users
- **Username**: `demo` | **Password**: `password123` | **Email**: `demo@hermetik.com`
- **Username**: `alice` | **Password**: `alice123` | **Email**: `alice@example.com`  
- **Username**: `bob` | **Password**: `bob123` | **Email**: `bob@example.com`

### Demo Portfolio Data
- **3 Mock Wallets** with realistic token holdings across multiple chains
- **$208K+ Total Portfolio Value** across all test wallets
- **Multiple DeFi Positions** including:
  - Uniswap V3 liquidity pools with unclaimed rewards
  - Aave V3 lending positions with yield
  - Compound V3 collateral positions
  - PancakeSwap farms on BSC
  - GMX staking on Arbitrum
  - Venus Protocol lending on BSC

### Mock Data Features
- **Realistic Token Holdings**: ETH, USDC, WBTC, UNI, MATIC, BNB, CAKE, ARB, GMX
- **DeFi Protocol Positions**: Complete position data with supply tokens and unclaimed rewards
- **Performance Metrics**: 30-day portfolio history with daily returns
- **APY Calculations**: Real-time yield calculations for DeFi positions
- **Multi-chain Distribution**: Positions across Ethereum, BSC, Arbitrum, and Polygon

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd hermetik-dashboard
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

4. Start the development server
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Login with Test Data

1. Go to the login page
2. Use any of the test user credentials above
3. Explore the dashboard with realistic portfolio data

## Environment Configuration

### Mock API Mode (Default)
```env
VITE_USE_MOCK_API=true
VITE_API_BASE_URL=http://localhost:5000/api
```

### Real API Mode
```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://your-backend-url/api
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # Layout components (Sidebar, Header)
│   └── UI/             # Basic UI components (Button, Card, etc.)
├── contexts/           # React contexts (Auth)
├── data/               # Mock data for testing
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API services and mock implementations
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Key Features Demonstrated

### Authentication System
- JWT token management with automatic logout
- Protected routes with redirect handling
- User profile management

### Portfolio Dashboard
- Real-time portfolio overview with key metrics
- Interactive charts showing portfolio performance
- Top holdings breakdown with percentage allocation

### Token Management
- Comprehensive token holdings table
- Multi-chain filtering and sorting
- Price tracking with USD values

### DeFi Positions
- Protocol-specific position tracking
- Unclaimed rewards monitoring
- APY calculations and yield tracking

### Analytics & Performance
- Historical portfolio performance charts
- Risk metrics (volatility, Sharpe ratio, max drawdown)
- Performance comparison over different time periods

### Data Management
- Excel export functionality
- Manual data refresh capabilities
- Wallet address management

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios

## API Integration

The application supports both mock and real API modes:

### Mock API Features
- Complete offline functionality
- Realistic data simulation
- Network delay simulation
- Error handling demonstration

### Real API Integration
- RESTful API communication
- JWT authentication
- Automatic token refresh
- Error handling and retry logic

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features
1. Create components in appropriate directories
2. Add TypeScript types in `src/types/`
3. Implement API services in `src/services/`
4. Add mock data in `src/data/mockData.ts`

## Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting provider

3. Configure environment variables for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.