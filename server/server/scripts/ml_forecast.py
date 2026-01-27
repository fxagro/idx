#!/usr/bin/env python3
"""
ML Forecast Script for AI Saham
Uses PyTorch LSTM to predict stock volatility based on historical price data
"""

import sys
import json
import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error
import warnings
warnings.filterwarnings('ignore')

class VolatilityLSTM(nn.Module):
    """Simple LSTM model for volatility prediction"""

    def __init__(self, input_size=1, hidden_size=50, num_layers=2, output_size=7):
        super(VolatilityLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # LSTM layer
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)

        # Fully connected layer
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        # Initialize hidden state and cell state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)

        # Forward propagate LSTM
        out, _ = self.lstm(x, (h0, c0))

        # Get the last output for prediction
        out = self.fc(out[:, -1, :])

        return out

def calculate_volatility(prices, window=30):
    """Calculate rolling volatility (standard deviation of returns)"""
    if len(prices) < window:
        return []

    volatilities = []
    for i in range(window, len(prices)):
        # Calculate daily returns
        returns = np.diff(prices[i-window:i]) / prices[i-window:i-1]
        # Calculate volatility (std dev of returns)
        vol = np.std(returns) * np.sqrt(252)  # Annualized volatility
        volatilities.append(vol)

    return volatilities

def generate_mock_data(symbol, days=60):
    """Generate mock historical data for testing"""
    np.random.seed(42)  # For reproducible results

    # Generate random walk price data
    base_price = 1000 + np.random.randint(1000, 9000)
    prices = [base_price]

    for _ in range(days - 1):
        # Random walk with slight upward drift
        change = np.random.normal(0.001, 0.02)  # Mean 0.1%, std 2%
        new_price = prices[-1] * (1 + change)
        prices.append(max(new_price, 10))  # Ensure price doesn't go negative

    return prices

def main():
    """Main function to run ML forecast"""
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python ml_forecast.py <symbol> <days>"}))
        sys.exit(1)

    symbol = sys.argv[1].upper()
    days = int(sys.argv[2])

    try:
        # Try to import required libraries
        try:
            import torch
            import torch.nn as nn
            from sklearn.preprocessing import MinMaxScaler
            TORCH_AVAILABLE = True
        except ImportError:
            TORCH_AVAILABLE = False

        if not TORCH_AVAILABLE:
            print(json.dumps({"error": "PyTorch not available, using mock data"}))
            sys.exit(1)

        # Generate or fetch historical data (mock for now)
        historical_prices = generate_mock_data(symbol, days=60)

        if len(historical_prices) < 40:
            raise ValueError("Insufficient historical data")

        # Calculate volatility series
        volatilities = calculate_volatility(historical_prices, window=30)

        if len(volatilities) < 10:
            raise ValueError("Insufficient volatility data for training")

        # Prepare data for LSTM
        # Use last 30 volatilities to predict next 7
        sequence_length = 30
        if len(volatilities) < sequence_length + 7:
            raise ValueError("Insufficient data for sequence length")

        # Normalize data
        scaler = MinMaxScaler(feature_range=(0, 1))
        volatility_data = np.array(volatilities).reshape(-1, 1)
        scaled_data = scaler.fit_transform(volatility_data)

        # Create sequences for training
        X, y = [], []
        for i in range(len(scaled_data) - sequence_length - 7):
            X.append(scaled_data[i:(i + sequence_length)])
            y.append(scaled_data[(i + sequence_length):(i + sequence_length + 7)])

        X = np.array(X)
        y = np.array(y)

        if len(X) == 0:
            raise ValueError("No training sequences created")

        # Convert to PyTorch tensors
        X_tensor = torch.FloatTensor(X)
        y_tensor = torch.FloatTensor(y)

        # Initialize model
        model = VolatilityLSTM(input_size=1, hidden_size=50, num_layers=2, output_size=7)

        # Loss and optimizer
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

        # Train model
        num_epochs = 10
        for epoch in range(num_epochs):
            model.train()
            outputs = model(X_tensor)
            optimizer.zero_grad()
            loss = criterion(outputs, y_tensor)
            loss.backward()
            optimizer.step()

        # Make prediction
        model.eval()
        with torch.no_grad():
            # Use last sequence for prediction
            last_sequence = torch.FloatTensor(scaled_data[-sequence_length:]).reshape(1, sequence_length, 1)
            prediction = model(last_sequence)

            # Inverse transform prediction
            prediction_reshaped = prediction.numpy().reshape(-1, 1)
            forecast_vol = scaler.inverse_transform(prediction_reshaped).flatten()

            # Ensure positive values and reasonable range
            forecast_vol = np.maximum(forecast_vol, 0.001)  # Minimum 0.1% volatility
            forecast_vol = np.minimum(forecast_vol, 0.20)   # Maximum 20% volatility

        # Calculate confidence based on training loss
        model.train()
        final_outputs = model(X_tensor)
        final_loss = criterion(final_outputs, y_tensor).item()
        confidence = max(0.5, min(0.95, 1.0 - final_loss))  # Convert loss to confidence

        # Generate trading signal based on average forecasted volatility
        avg_forecast_vol = np.mean(forecast_vol)
        if avg_forecast_vol < 0.025:
            signal = 'BUY'   # Low volatility - good entry point
        elif avg_forecast_vol < 0.035:
            signal = 'HOLD'  # Moderate volatility - wait
        else:
            signal = 'SELL'  # High volatility - risky

        # Prepare response
        result = {
            "symbol": symbol,
            "forecast_vol": [round(float(x), 4) for x in forecast_vol],
            "confidence": round(float(confidence), 2),
            "signal": signal,
            "avg_volatility": round(float(avg_forecast_vol), 4),
            "source": "lstm_model"
        }

        print(json.dumps(result))

    except Exception as e:
        # Fallback to mock data on any error
        print(json.dumps({
            "symbol": symbol,
            "forecast_vol": [round(0.02 + (i * 0.001), 4) for i in range(days)],
            "confidence": 0.75,
            "signal": "HOLD",
            "avg_volatility": 0.025,
            "source": "mock",
            "error": str(e)
        }))

if __name__ == "__main__":
    main()