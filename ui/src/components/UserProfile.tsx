import React, { useEffect, useState } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { User, Mail, Save, ArrowLeft, Shield } from 'lucide-react';

interface UserProfileProps {
    onBack: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onBack }) => {
    const [email, setEmail] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Load the user's data from their secure Cognito session
    useEffect(() => {
        const loadUser = async () => {
            try {
                const attributes = await fetchUserAttributes();
                setEmail(attributes.email || '');
                
                // In a full production app, you would fetch the display name 
                // from your DynamoDB backend via API Gateway here.
                // For now, we default to the first part of their email.
                setDisplayName(attributes.email?.split('@')[0] || 'Stranger');
            } catch (err) {
                console.error("Failed to fetch user attributes", err);
            }
        };
        loadUser();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        // TODO: Send an HTTP POST to your AWS API Gateway/Rust Backend
        // to update the user's profile document in DynamoDB.
        console.log("Saving new display name to DynamoDB:", displayName);
        
        setTimeout(() => setIsSaving(false), 1000); // Simulate network latency
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl mt-8">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-gray-800 rounded-full transition-all text-gray-400 hover:text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-2xl font-bold">User Profile</h2>
                </div>
                <Shield className="text-blue-500" size={24} />
            </div>

            <form onSubmit={handleSave} className="p-8 flex flex-col gap-6">
                {/* Email Address (Read-Only from Cognito) */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                        <Mail size={16} /> Account Email
                    </label>
                    <input 
                        type="email" 
                        value={email} 
                        disabled
                        className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed outline-none"
                    />
                    <p className="text-xs text-gray-500">Your email is managed securely by AWS Cognito and cannot be changed here.</p>
                </div>

                {/* Display Name (Editable, saves to DynamoDB) */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                        <User size={16} /> Public Display Name
                    </label>
                    <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter a display name"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    />
                    <p className="text-xs text-gray-500">This is the name other strangers will see in the text chat.</p>
                </div>

                {/* Account Actions */}
                <div className="pt-4 mt-2 border-t border-gray-800 flex justify-end">
                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-6 py-3 rounded-lg font-bold transition-all"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save size={18} />
                        )}
                        {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
};