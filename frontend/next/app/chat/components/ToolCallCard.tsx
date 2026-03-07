'use client';

import { ToolCall } from '../hooks/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

// Clock icon for time tool
const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Weather/Cloud icon
const WeatherIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

// Sun icon for sunny weather
const SunIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

// Rain icon
const RainIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 18l-2 4m-4-4l-2 4m8-4l-2 4" />
  </svg>
);

// Snow icon
const SnowIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m-6-6l6 6 6-6m-12-6l6-6 6 6" />
  </svg>
);

// Loading spinner
const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// Generic tool icon
const ToolIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Normalize newlines in output string (handle both literal \n and actual newlines)
function normalizeNewlines(output: string): string {
  // Replace literal \n (backslash + n) with actual newline
  return output.replace(/\\n/g, '\n');
}

// Parse time output and extract date and time separately
function parseTimeOutput(output: string): { date: string; time: string } | null {
  const normalized = normalizeNewlines(output);
  // Format: "Current local time: 2025-11-27 00:21:54"
  const datetimeMatch = normalized.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (datetimeMatch) {
    return {
      date: datetimeMatch[1],
      time: datetimeMatch[2],
    };
  }
  return null;
}

// Parse weather output and extract relevant info
function parseWeatherOutput(output: string): {
  location: string;
  condition: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
} | null {
  try {
    const normalized = normalizeNewlines(output);
    const lines = normalized.split('\n');
    const locationMatch = lines[0]?.match(/Weather in ([^:]+):/);
    const conditionMatch = lines.find(l => l.includes('Condition:'))?.match(/Condition:\s*(.+)/);
    const tempMatch = lines.find(l => l.includes('Temperature:'))?.match(/Temperature:\s*(-?\d+)/);
    const humidityMatch = lines.find(l => l.includes('Humidity:'))?.match(/Humidity:\s*(\d+)/);
    const windMatch = lines.find(l => l.includes('Wind Speed:'))?.match(/Wind Speed:\s*(\d+)/);
    
    if (locationMatch && conditionMatch && tempMatch) {
      return {
        location: locationMatch[1].trim(),
        condition: conditionMatch[1].trim(),
        temperature: parseInt(tempMatch[1]),
        humidity: humidityMatch ? parseInt(humidityMatch[1]) : 0,
        windSpeed: windMatch ? parseInt(windMatch[1]) : 0,
      };
    }
  } catch (e) {
    console.error('Failed to parse weather output:', e);
  }
  return null;
}

// Get weather icon based on condition
function getWeatherIcon(condition: string, className: string) {
  const lowerCondition = condition.toLowerCase();
  if (lowerCondition.includes('sunny') || lowerCondition.includes('clear')) {
    return <SunIcon className={className} />;
  } else if (lowerCondition.includes('rain')) {
    return <RainIcon className={className} />;
  } else if (lowerCondition.includes('snow')) {
    return <SnowIcon className={className} />;
  } else {
    return <WeatherIcon className={className} />;
  }
}

// Get weather gradient based on condition
function getWeatherGradient(condition: string): string {
  const lowerCondition = condition.toLowerCase();
  if (lowerCondition.includes('sunny') || lowerCondition.includes('clear')) {
    return 'from-yellow-400 via-orange-400 to-red-400';
  } else if (lowerCondition.includes('rain')) {
    return 'from-slate-400 via-blue-400 to-indigo-500';
  } else if (lowerCondition.includes('snow')) {
    return 'from-slate-200 via-blue-200 to-indigo-300';
  } else if (lowerCondition.includes('cloudy')) {
    return 'from-gray-300 via-slate-400 to-gray-500';
  } else if (lowerCondition.includes('fog')) {
    return 'from-gray-200 via-gray-300 to-gray-400';
  } else if (lowerCondition.includes('wind')) {
    return 'from-teal-300 via-cyan-400 to-blue-400';
  }
  return 'from-blue-400 via-purple-400 to-pink-400';
}

// Time Card Component - Digital clock style
function TimeCard({ toolCall }: { toolCall: ToolCall }) {
  const isRunning = toolCall.status === 'running';
  const timeData = toolCall.output ? parseTimeOutput(toolCall.output) : null;
  
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-black p-0.5 shadow-lg">
      <div className="rounded-[10px] bg-gradient-to-br from-slate-900 to-black p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <ClockIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">
            Local Time
          </span>
        </div>
        
        {isRunning ? (
          <div className="flex items-center justify-center py-4">
            <LoadingSpinner className="w-8 h-8 text-cyan-400" />
            <span className="ml-3 text-slate-400">Fetching time...</span>
          </div>
        ) : timeData ? (
          <div className="text-center">
            {/* Digital clock display */}
            <div className="font-mono text-4xl font-bold text-cyan-400 tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              {timeData.time}
            </div>
            {/* Date display */}
            <div className="mt-2 text-sm text-slate-400 font-mono">
              📅 {timeData.date}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 whitespace-pre-wrap">
            {normalizeNewlines(toolCall.output || 'No data')}
          </div>
        )}
      </div>
    </div>
  );
}

// Weather Card Component
function WeatherCard({ toolCall }: { toolCall: ToolCall }) {
  const isRunning = toolCall.status === 'running';
  const weatherData = toolCall.output ? parseWeatherOutput(toolCall.output) : null;
  const location = (toolCall.input.location as string) || 'Unknown';
  
  const gradient = weatherData ? getWeatherGradient(weatherData.condition) : 'from-blue-400 to-purple-500';
  
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-0.5 shadow-lg`}>
      <div className="rounded-[10px] bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur p-4">
        <div className="flex items-start gap-3">
          {/* Weather icon */}
          <div className="relative flex-shrink-0">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} bg-opacity-20 flex items-center justify-center`}>
              {isRunning ? (
                <LoadingSpinner className="w-8 h-8 text-blue-500" />
              ) : weatherData ? (
                getWeatherIcon(weatherData.condition, 'w-8 h-8 text-blue-600 dark:text-blue-400')
              ) : (
                <WeatherIcon className="w-8 h-8 text-blue-500" />
              )}
            </div>
          </div>
          
          {/* Weather info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                🌤️ Weather
              </span>
            </div>
            {isRunning ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Fetching weather for {location}...
              </div>
            ) : weatherData ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {weatherData.temperature}°C
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {weatherData.condition}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  📍 {weatherData.location}
                </div>
                <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>💧 {weatherData.humidity}%</span>
                  <span>💨 {weatherData.windSpeed} km/h</span>
                </div>
                <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 italic">
                  ⚠️ Simulated data for demo
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                {normalizeNewlines(toolCall.output || 'No data')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Generic Tool Card Component
function GenericToolCard({ toolCall }: { toolCall: ToolCall }) {
  const isRunning = toolCall.status === 'running';
  
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 p-0.5 shadow-lg">
      <div className="rounded-[10px] bg-white dark:bg-[#1e1e1e] p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            {isRunning ? (
              <LoadingSpinner className="w-5 h-5 text-gray-500" />
            ) : (
              <ToolIcon className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
              🔧 {toolCall.tool}
            </div>
            {isRunning ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Running...
              </div>
            ) : (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {normalizeNewlines(toolCall.output || 'No output')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main ToolCallCard component
export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  // Route to specialized card based on tool name
  if (toolCall.tool === 'get_current_time') {
    return <TimeCard toolCall={toolCall} />;
  } else if (toolCall.tool === 'get_weather') {
    return <WeatherCard toolCall={toolCall} />;
  } else {
    return <GenericToolCard toolCall={toolCall} />;
  }
}

