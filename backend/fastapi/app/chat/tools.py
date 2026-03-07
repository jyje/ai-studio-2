"""Built-in tools for LangGraph ReAct agent."""

import random
from datetime import datetime
from langchain_core.tools import tool


@tool
def get_current_time() -> str:
    """Get the current local time of the server.
    
    Returns:
        A formatted string with the current local date and time.
    """
    now = datetime.now()
    return f"Current local time: {now.strftime('%Y-%m-%d %H:%M:%S')}"


@tool
def get_weather(location: str) -> str:
    """Get the current weather for a specific location.
    
    This is a pseudo implementation that returns random weather data for demonstration purposes.
    
    Args:
        location: The location to get weather for (e.g., "Seoul", "New York", "London").
    
    Returns:
        A formatted string with weather information for the specified location.
    """
    # Pseudo weather data - random values for demonstration
    conditions = ["Sunny", "Cloudy", "Partly Cloudy", "Rainy", "Snowy", "Foggy", "Windy"]
    condition = random.choice(conditions)
    temperature = random.randint(-10, 35)  # Celsius
    humidity = random.randint(30, 90)  # Percentage
    wind_speed = random.randint(0, 30)  # km/h
    
    return (
        f"Weather in {location}:\n"
        f"  Condition: {condition}\n"
        f"  Temperature: {temperature}°C\n"
        f"  Humidity: {humidity}%\n"
        f"  Wind Speed: {wind_speed} km/h\n"
        f"  (Note: This is simulated weather data for demonstration)"
    )


# List of all available tools for the agent
AVAILABLE_TOOLS = [get_current_time, get_weather]

