"""
Market Data Provider Interface (Strategy Pattern).
Decouples the application from specific data sources (OpenBB, Yahoo, etc.).
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

class MarketDataProvider(ABC):
    """Abstract base class for market data providers."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider connection."""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Close the provider connection."""
        pass

    @abstractmethod
    async def get_stock_price(self, ticker: str) -> float:
        """Fetch real-time price for a ticker."""
        pass

    @abstractmethod
    async def get_historical_data(self, ticker: str, days: int = 30) -> List[Dict[str, Any]]:
        """Fetch historical price data."""
        pass

    @abstractmethod
    async def get_candles(
        self,
        ticker: str,
        interval: str = "5m",
        limit: int = 200,
    ) -> Dict[str, Any]:
        """Fetch OHLCV candle data for charting."""
        pass

    @abstractmethod
    async def get_company_profile(self, ticker: str) -> Dict[str, Any]:
        """Fetch company profile information."""
        pass
