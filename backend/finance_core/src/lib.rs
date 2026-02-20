use pyo3.prelude::*;

/// Efficiently calculates compound interest.
/// Formula: P * (1 + r/n)^(n*t)
#[pyfunction]
fn calculate_compound_interest(principal: f64, rate: f64, times_per_year: u32, years: u32) -> PyResult<f64> {
    let r = rate / 100.0;
    let n = times_per_year as f64;
    let t = years as f64;
    let body = 1.0 + (r / n);
    let exponent = n * t;
    Ok(principal * body.powf(exponent))
}

/// Calculates the impact of inflation on purchasing power.
/// Formula: Amount / (1 + inflation_rate)^years
#[pyfunction]
fn calculate_inflation_impact(amount: f64, inflation_rate: f64, years: u32) -> PyResult<f64> {
    let r = inflation_rate / 100.0;
    let t = years as f64;
    let denominator = (1.0 + r).powf(t);
    Ok(amount / denominator)
}

/// A Python module implemented in Rust.
#[pymodule]
fn finance_core(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_compound_interest, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_inflation_impact, m)?)?;
    Ok(())
}
