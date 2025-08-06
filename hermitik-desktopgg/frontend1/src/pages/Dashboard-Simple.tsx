import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard</h1>
      <div className="bg-gray-800 p-4 rounded-lg">
        <p className="text-white">✅ Frontend is working!</p>
        <p className="text-gray-400 mt-2">Backend URL: {import.meta.env.VITE_API_BASE_URL}</p>
        <p className="text-gray-400">Mock API: {import.meta.env.VITE_USE_MOCK_API}</p>
      </div>
    </div>
  );
};

export default Dashboard;