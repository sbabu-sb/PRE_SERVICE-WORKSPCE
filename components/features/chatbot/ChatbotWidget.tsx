import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, XCircle, Loader } from 'lucide-react';
import { useEstimateState } from '../../../context/EstimateContext';
import { fetchChatbotResponse } from '../../../services/geminiService';

const ChatbotWidget: React.FC = () => {
    const appState = useEstimateState();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ sender: 'bot' | 'user'; text: string }[]>([
        { sender: 'bot', text: "Hi! I'm PEC Chat. Ask me a question about your current estimate." }
    ]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const userMessage = newMessage.trim();
        if (!userMessage || isLoading) return;

        setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
        setNewMessage('');
        setIsLoading(true);

        const result = await fetchChatbotResponse(userMessage, appState);

        if (result.success && result.data) {
            setMessages(prev => [...prev, { sender: 'bot', text: result.data.response }]);
        } else {
            setMessages(prev => [...prev, { sender: 'bot', text: `Sorry, I had an error: ${result.error}` }]);
        }
        setIsLoading(false);
    };

    return (
        <>
            {isOpen && (
                <div className="fixed bottom-24 right-4 sm:right-8 w-80 sm:w-96 h-[500px] bg-white rounded-xl shadow-2xl z-40 flex flex-col border border-gray-200/80 transition-all duration-300 animate-fade-in">
                    <div className="bg-blue-600 text-white p-3 flex justify-between items-center rounded-t-xl">
                        <h3 className="font-bold text-lg">PEC Chat</h3>
                        <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white"><XCircle className="h-6 w-6" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${ msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-lg' : 'bg-gray-200 text-gray-800 rounded-bl-lg' }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (<div className="flex justify-start"><div className="p-3 rounded-2xl bg-gray-200 text-gray-800 rounded-bl-lg"><Loader className="h-4 w-4 animate-spin" /></div></div>)}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSend} className="p-3 border-t bg-white rounded-b-xl flex items-center space-x-2">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Ask about your estimate..."
                            className="bg-white text-gray-900 flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" disabled={isLoading} />
                        <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg disabled:bg-gray-400 hover:bg-blue-700 transition" disabled={isLoading || !newMessage.trim()}>
                            <Send className="h-5 w-5" />
                        </button>
                    </form>
                </div>
            )}
            <button onClick={() => setIsOpen(prev => !prev)}
                className="bg-blue-600 text-white p-3 rounded-full shadow-md hover:bg-blue-700 transition" aria-label="Open Chat">
                {isOpen ? <XCircle className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>
        </>
    );
};

export default ChatbotWidget;