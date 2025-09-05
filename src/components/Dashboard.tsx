import React, { useState, useEffect, useMemo } from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  Sun,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  TrendingUp,
  Search,
  Globe,
  Loader2,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';

// === CONFIG ===
const AQICN_API_TOKEN = '8065ba76c4e7a82cb055fe8249d312b08c4ec58d';

interface EnvironmentalData {
  timestamp: string;
  temperature: number;
  humidity: number;
  pm25: number;
  uvIndex: number;
  windSpeed: number;
  heatIndex: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-semibold">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Metric Card Component
const MetricCard = ({ icon, label, value, unit, subText }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  subText?: string;
}) => (
  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition-shadow dark:bg-gray-800 dark:border-gray-700 dark:text-white">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">
          {value} {unit && <span className="text-lg">{unit}</span>}
        </p>
        {subText && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{subText}</p>}
      </div>
      <div className="text-gray-400 dark:text-gray-500">{icon}</div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [currentData, setCurrentData] = useState<EnvironmentalData | null>(null);
  const [historicalData, setHistoricalData] = useState<EnvironmentalData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('India');
  const [lat, setLat] = useState<number>(31.326); // Jalandhar
  const [lon, setLon] = useState<number>(75.5762);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<{ name: string; country: string; lat: number; lon: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // 🔌 PWA Install Prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // 🌙 Dark Mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // 🔔 Alert Notifications
  const [alertEnabled, setAlertEnabled] = useState<boolean>(false);

  // Load last city from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lastCity');
    if (saved) {
      const { city, country, lat, lon } = JSON.parse(saved);
      setCity(city);
      setCountry(country);
      setLat(lat);
      setLon(lon);
      fetchAQIData(lat, lon, city, country);
    } else {
      setCity('Jalandhar');
      fetchAQIData(31.326, 75.5762, 'Jalandhar', 'India');
    }
  }, []);

  // 💡 Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // 📲 PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 🔔 Request Notification Permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  // ⚠️ Watch for Risk Level Change Alerts
  useEffect(() => {
    if (!alertEnabled || !currentData || historicalData.length < 2) return;

    const lastRisk = historicalData[historicalData.length - 2]?.riskLevel;
    const currentRisk = currentData.riskLevel;

    if (lastRisk && lastRisk !== currentRisk) {
      const title = `Risk Level Changed to ${currentRisk}`;
      const body = `Temp: ${currentData.temperature}°C, PM2.5: ${currentData.pm25} μg/m³`;

      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') new Notification(title, { body });
        });
      }
    }
  }, [currentData, alertEnabled, historicalData]);

  // Fetch AQI Data
  const fetchAQIData = async (
    latitude: number,
    longitude: number,
    cityName: string,
    countryName: string = 'India'
  ) => {
    try {
      setLoading(true);
      setError(null);
      setIsSearching(false);

      const res = await fetch(
        `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${AQICN_API_TOKEN}`
      );

      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);

      const data = await res.json();

      if (data.status !== 'ok') {
        throw new Error(data.data || 'No station found nearby');
      }

      const airQuality = data.data.iaqi;
      const current = data.data;

      const temperature = airQuality.t?.v || 35;
      const humidity = airQuality.h?.v || 40;
      const pm25 = airQuality.pm25?.v || 50;
      const windSpeed = airQuality.w?.v || 5;
      const uvIndex = current.uv || 6;
      const heatIndex = calculateHeatIndex(temperature, humidity);

      const newData: EnvironmentalData = {
        timestamp: new Date().toISOString(),
        temperature: +temperature.toFixed(1),
        humidity: Math.round(humidity),
        pm25: Math.round(pm25),
        uvIndex: Math.round(uvIndex),
        windSpeed: +windSpeed.toFixed(1),
        heatIndex: +heatIndex.toFixed(1),
        riskLevel: calculateRiskLevel(heatIndex, pm25, uvIndex),
      };

      setCurrentData(newData);
      setHistoricalData((prev) => [...prev, newData].slice(-24));
      setCity(cityName);
      setCountry(countryName);

      // Save to localStorage
      localStorage.setItem(
        'lastCity',
        JSON.stringify({ city: cityName, country: countryName, lat: latitude, lon: longitude })
      );
    } catch (err: any) {
      console.error('Fetch failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch city suggestions
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(
        `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=5&appid=93d9fe329c9efb6156eb0736d6600442`
      );

      if (!res.ok) throw new Error('Network error');

      const data = await res.json();
      const cities = data.map((item: any) => ({
        name: item.name,
        country: item.country,
        lat: item.lat,
        lon: item.lon,
      }));

      setSuggestions(cities);
      setShowSuggestions(cities.length > 0);
    } catch (err) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Get User Location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchAQIData(latitude, longitude, 'Your Location', '');
      },
      (err) => {
        setError(`Unable to get location: ${err.message}`);
        setLoading(false);
      }
    );
  };

  // Heat Index
  const calculateHeatIndex = (temp: number, humidity: number): number => {
    if (temp < 27) return temp;
    const T = temp;
    const RH = humidity;
    let HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH;
    HI += -0.00683783 * T * T - 0.05481717 * RH * RH + 0.00122874 * T * T * RH;
    HI += 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
    return Math.max(temp, HI);
  };

  // Risk Level
  const calculateRiskLevel = (heatIndex: number, pm25: number, uvIndex: number): 'Low' | 'Medium' | 'High' => {
    let riskScore = 0;
    if (heatIndex > 45) riskScore += 3;
    else if (heatIndex > 40) riskScore += 2;
    else if (heatIndex > 35) riskScore += 1;
    if (pm25 > 75) riskScore += 2;
    else if (pm25 > 50) riskScore += 1;
    if (uvIndex > 8) riskScore += 1;
    return riskScore >= 4 ? 'High' : riskScore >= 2 ? 'Medium' : 'Low';
  };

  // Risk UI
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400';
      case 'Medium': return 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400';
      case 'Low': return 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400';
      default: return 'text-gray-600';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'High': return <XCircle className="w-5 h-5 text-red-600 dark:text-red-500" />;
      case 'Medium': return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />;
      case 'Low': return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Time', 'Temperature (°C)', 'Humidity (%)', 'PM2.5 (μg/m³)', 'UV Index', 'Wind Speed (km/h)', 'Heat Index (°C)', 'Risk Level'];
    const rows = historicalData.map(d => [
      format(new Date(d.timestamp), 'yyyy-MM-dd HH:mm'),
      d.temperature,
      d.humidity,
      d.pm25,
      d.uvIndex,
      d.windSpeed,
      d.heatIndex,
      d.riskLevel
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `environmental-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart Data
  const chartData = useMemo(() => {
    return historicalData.map((d) => ({
      time: format(new Date(d.timestamp), 'HH:mm'),
      temperature: d.temperature,
      heatIndex: d.heatIndex,
      humidity: d.humidity,
      pm25: d.pm25,
      uvIndex: d.uvIndex,
    }));
  }, [historicalData]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle search
  const searchCity = (query: string) => {
    if (!query.trim()) return;
    const suggestion = suggestions.find(s => s.name.toLowerCase() === query.toLowerCase());
    if (suggestion) {
      fetchAQIData(suggestion.lat, suggestion.lon, suggestion.name, suggestion.country);
      setSearchQuery(suggestion.name);
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      setError('City not found. Please try another.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 dark:from-slate-900 dark:via-gray-800 dark:to-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-orange-100 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-gradient-to-r from-white-500 to-black-500 rounded-lg shadow">
                <img src="/assets/logo.png" alt="TharUrja_Guard Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">TharUrja_Guard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Environmental Intelligence Platform</p>
              </div>
            </div>

            {/* Search & Controls */}
            <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-2xl search-container">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search city..."
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    fetchSuggestions(value);
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && searchCity(searchQuery)}
                  onFocus={() => searchQuery && showSuggestions && setSuggestions(suggestions)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-400" />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="px-4 py-2 hover:bg-orange-50 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchAQIData(suggestion.lat, suggestion.lon, suggestion.name, suggestion.country);
                          setSearchQuery(suggestion.name);
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{suggestion.name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{suggestion.country}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                onClick={() => searchCity(searchQuery)}
                disabled={!searchQuery.trim() || isSearching}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center min-w-12"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>

              <button
                onClick={getUserLocation}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 dark:border-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
              >
                <Globe className="w-4 h-4" />
                <span>My Location</span>
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="ml-auto text-xl focus:outline-none"
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Location Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
            <MapPin className="w-6 h-6 text-orange-500" />
            {city}
            {country && <span className="text-lg font-normal text-gray-600 dark:text-gray-300">, {country}</span>}
          </h2>
          {loading && <p className="text-gray-500 dark:text-gray-400">Fetching environmental data...</p>}
        </div>

        {/* Error Alert */}
        {error && !currentData && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 text-center">
            <p>{error}</p>
            <button
              onClick={() => fetchAQIData(lat, lon, city, country)}
              className="mt-2 text-sm underline hover:text-red-800 dark:hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Risk Banner */}
        {currentData && !error && (
          <div className={`mb-8 p-5 rounded-xl border-2 shadow-lg ${getRiskColor(currentData.riskLevel)} animate-fade-in`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                {getRiskIcon(currentData.riskLevel)}
                <div>
                  <h2 className="text-xl font-bold">Risk Level: {currentData.riskLevel}</h2>
                  <p className="text-sm opacity-90 max-w-lg">
                    {currentData.riskLevel === 'High' && 'Avoid outdoor exposure. Seek shade and stay hydrated.'}
                    {currentData.riskLevel === 'Medium' && 'Take precautions during extended outdoor activity.'}
                    {currentData.riskLevel === 'Low' && 'Conditions are favorable for outdoor activities.'}
                  </p>
                </div>
              </div>
              <div className="text-sm opacity-80 flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(currentData.timestamp), 'MMM dd, HH:mm')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {currentData && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              icon={<Thermometer className="w-6 h-6" />}
              label="Temperature"
              value={currentData.temperature}
              unit="°C"
              subText={`Feels like ${currentData.heatIndex}°C`}
            />
            <MetricCard
              icon={<Droplets className="w-6 h-6" />}
              label="Humidity"
              value={currentData.humidity}
              unit="%"
            />
            <MetricCard
              icon={<Wind className="w-6 h-6" />}
              label="PM2.5"
              value={currentData.pm25}
              unit="μg/m³"
              subText={currentData.pm25 > 75 ? 'Unhealthy' : currentData.pm25 > 50 ? 'Moderate' : 'Good'}
            />
            <MetricCard
              icon={<Sun className="w-6 h-6" />}
              label="UV Index"
              value={currentData.uvIndex}
              subText={`Wind: ${currentData.windSpeed} km/h`}
            />
          </div>
        )}

        {/* Charts */}
        {currentData && !error && historicalData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Temperature Trend (24h)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" fontSize={12} stroke="#9ca3af" />
                  <YAxis fontSize={12} stroke="#9ca3af" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="heatIndex" name="Feels Like" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Air Quality & UV Index</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.slice(-12)} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" angle={-45} textAnchor="end" height={60} stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pm25" name="PM2.5 (μg/m³)" fill="#8b5cf6" />
                  <Bar dataKey="uvIndex" name="UV Index" fill="#eab308" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Export & Alerts */}
        <div className="flex flex-wrap items-center gap-6 mb-6">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Export to CSV
          </button>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={alertEnabled}
                onChange={() => setAlertEnabled(!alertEnabled)}
                className="rounded accent-yellow-500"
              />
              <span className="text-sm">Enable Risk Change Alerts</span>
            </label>
          </div>

          {/* PWA Install Button */}
          {installPrompt && (
            <button
              onClick={() => {
                (installPrompt as any).prompt();
                (installPrompt as any).userChoice.then(() => setInstallPrompt(null));
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Install App
            </button>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Health & Safety Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Hydration</h4>
              <p className="text-sm text-blue-700 dark:text-blue-200">Drink water every 15–20 minutes. Avoid alcohol and caffeine.</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">Work Schedule</h4>
              <p className="text-sm text-green-700 dark:text-green-200">Limit outdoor work between 11 AM – 4 PM. Take 10-min breaks hourly.</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">Protection</h4>
              <p className="text-sm text-purple-700 dark:text-purple-200">Wear masks when PM2.5 &gt; 50. Use sunscreen and UV-protective clothing.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10">
          Powered by TharUrja • Data updated in real-time
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
