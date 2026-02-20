"""
Wrapper for finance_core to handle Rust compilation absence gracefully.
"""
import logging

logger = logging.getLogger(__name__)

try:
    # Try importing the compiled Rust module (usually named finance_core)
    # When using maturin develop, it installs into site-packages as finance_core
    from finance_core import calculate_compound_interest, calculate_inflation_impact
    RUST_AVAILABLE = True
    logger.info("🚀 Rust Finance Core loaded: 10x Speed Activated")
except ImportError:
    # Fallback to Python implementation
    from .fallback import calculate_compound_interest, calculate_inflation_impact
    RUST_AVAILABLE = False
    logger.warning("⚠️ Rust Finance Core not found. Using Python fallback. Run 'maturin develop' to enable acceleration.")

__all__ = ["calculate_compound_interest", "calculate_inflation_impact", "RUST_AVAILABLE"]
