import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, X, Terminal, Sparkles, Brain, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  thought?: string;
  timestamp: string;
}

interface SrinivasaAIChatProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTargetName?: string;
  telemetryData?: any;
}

export default function SrinivasaAIChat({
  isOpen,
  onClose,
  selectedTargetName = "Sol (Sun)",
  telemetryData = {}
}: SrinivasaAIChatProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("srinivasa_ai_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        role: "assistant",
        content: `SYS_COMMS LINK ESTABLISHED // DEEPSEEK_R1_1.5B SYSTEM ACTIVE.\n\nWelcome to the SRINIVASA Orbital Simulator. I am your Tactical AI Advisor. I can assist you with celestial trajectories, gravitational vectors, n-body physics, orbital rendezvous calculations, and rocket telemetry. Ask me anything about ${selectedTargetName || 'your path'} or orbital navigation!`,
        timestamp: new Date().toLocaleTimeString()
      }
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("srinivasa_ai_history", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  // Helper to parse DeepSeek reasoning steps from standard response
  const parseDeepSeekResponse = (rawText: string) => {
    let thought = "";
    let content = rawText;

    const thinkStart = rawText.indexOf("<think>");
    const thinkEnd = rawText.indexOf("</think>");

    if (thinkStart !== -1) {
      if (thinkEnd !== -1) {
        thought = rawText.slice(thinkStart + 7, thinkEnd).trim();
        content = rawText.slice(thinkEnd + 8).trim();
      } else {
        // Unclosed think block (streaming or cut-off)
        thought = rawText.slice(thinkStart + 7).trim();
        content = "";
      }
    }
    return { thought, content };
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setIsLoading(true);

    const newMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: userMsg,
        timestamp: new Date().toLocaleTimeString()
      }
    ];
    setMessages(newMessages);

    try {
      // Proxy through local Express backend to prevent CORS blockages on custom nodes
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: userMsg,
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Advisor offline (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      // Determine response format based on varying server returns
      let botResponse = "";
      if (typeof data === "string") {
        botResponse = data;
      } else if (data && typeof data === "object") {
        botResponse = data.text || data.response || data.content || data.generated_text || JSON.stringify(data);
      } else {
        throw new Error("Invalid format from server");
      }

      const { thought, content } = parseDeepSeekResponse(botResponse);

      const assistantMsg: Message = {
        role: "assistant",
        content: content || "System trace returned void response.",
        thought: thought || undefined,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto expand new thoughts by default
      if (thought) {
        const nextIndex = newMessages.length;
        setExpandedThoughts(prev => ({ ...prev, [nextIndex]: true }));
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **COMMS ERROR**: Failed to communicate with DeepSeek R1 core node. (${err.message || 'Check srinivasa.2bd.net availability'}).`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleThought = (index: number) => {
    setExpandedThoughts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const clearHistory = () => {
    const defaultMsg: Message = {
      role: "assistant",
      content: `SYS_COMMS reset. DEEPSEEK_R1_1.5B node flushed. Ask me anything about orbital physics or ${selectedTargetName}.`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages([defaultMsg]);
    setExpandedThoughts({});
    localStorage.removeItem("srinivasa_ai_history");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full md:w-96 h-full flex flex-col border-l-2 border-outline-variant bg-surface-container-lowest/95 backdrop-blur-md z-50 relative pointer-events-auto shadow-2xl flex-shrink-0"
        >
          {/* Header */}
          <div className="p-4 border-b-2 border-outline-variant bg-black flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-primary-fixed rounded-full animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-on-surface tracking-widest uppercase flex items-center gap-1">
                  AI_ADVISOR // R1
                </span>
                <span className="text-[8px] text-secondary">DEEPSEEK_CO-PROCESSOR</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={clearHistory}
                className="text-[9px] hover:text-primary text-secondary border border-outline-variant px-1.5 py-0.5 uppercase cursor-pointer hover:border-primary transition-colors font-mono"
                title="Clear transmission history"
              >
                Reset
              </button>
              <button
                onClick={onClose}
                className="text-secondary hover:text-primary cursor-pointer transition-colors"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Context Stats */}
          <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex justify-between items-center text-[9px] text-secondary font-mono">
            <span>COORDS: {selectedTargetName.toUpperCase()}</span>
            <span className="flex items-center gap-1 text-primary-fixed">
              <Brain size={10} /> LATENCY: NOM_0.4s
            </span>
          </div>

          {/* Chat Messages */}
          <div
            ref={chatBodyRef}
            className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 font-mono text-[11px] leading-relaxed select-text"
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col max-w-[90%] ${
                  msg.role === "user" ? "self-end items-end" : "self-start items-start"
                }`}
              >
                {/* Timestamp & Tag */}
                <span className="text-[8px] text-secondary mb-1">
                  {msg.role === "user" ? "USER" : "CO-PROCESSOR"} // {msg.timestamp}
                </span>

                {/* Message Body */}
                <div
                  className={`p-3 border-2 ${
                    msg.role === "user"
                      ? "border-primary-fixed bg-primary-container/20 text-primary-fixed"
                      : "border-outline-variant bg-black text-on-surface"
                  } relative`}
                >
                  {/* Design accent lines */}
                  <div className="absolute top-0 left-0 w-2 h-[2px] bg-primary"></div>
                  <div className="absolute top-0 left-0 w-[2px] h-2 bg-primary"></div>

                  {/* Render deepseek thoughts if available */}
                  {msg.thought && (
                    <div className="mb-2 border-b border-outline-variant/30 pb-2">
                      <button
                        onClick={() => toggleThought(index)}
                        className="flex items-center gap-1.5 text-[9px] text-secondary cursor-pointer hover:text-primary transition-colors w-full text-left"
                      >
                        <Brain size={10} className="animate-pulse text-primary-fixed" />
                        <span className="font-bold tracking-wider uppercase">
                          {expandedThoughts[index] ? "Hide DeepSeek Reasoning" : "View DeepSeek Reasoning"}
                        </span>
                        <ArrowDown
                          size={8}
                          className={`transform transition-transform ${expandedThoughts[index] ? "rotate-180" : ""}`}
                        />
                      </button>

                      {expandedThoughts[index] && (
                        <div className="mt-2 text-[9px] bg-[#050505] text-secondary/90 p-2.5 border-l-2 border-primary-fixed/50 italic font-sans whitespace-pre-wrap leading-normal">
                          {msg.thought}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="prose prose-invert max-w-none text-[11px] space-y-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="self-start flex flex-col items-start max-w-[80%]">
                <span className="text-[8px] text-secondary mb-1">CO-PROCESSOR // CALCULATING</span>
                <div className="p-3 border-2 border-primary-fixed bg-black text-primary-fixed flex items-center gap-2">
                  <Terminal size={12} className="animate-spin" />
                  <span className="animate-pulse tracking-widest font-bold">THINKING_WITH_DEEPSEEK_R1...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {messages.length === 1 && (
            <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-outline-variant bg-surface-container-low">
              {[
                `How do I launch to Venus?`,
                `Describe Hohmann transfer`,
                `What is Kepler's Third Law?`
              ].map(suggest => (
                <button
                  key={suggest}
                  onClick={() => {
                    setInput(suggest);
                  }}
                  className="text-[9px] border border-outline-variant bg-black hover:border-primary-fixed hover:text-primary-fixed px-2 py-1 text-secondary transition-colors cursor-pointer"
                >
                  {suggest}
                </button>
              ))}
            </div>
          )}

          {/* Comms input */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t-2 border-outline-variant bg-black flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Transmit tactical query..."
              disabled={isLoading}
              className="flex-1 bg-[#050505] text-on-surface text-[11px] font-mono px-3 py-2 border-2 border-outline-variant focus:border-primary-fixed outline-none focus:text-primary-fixed h-9"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-primary-fixed-dim text-on-primary h-9 px-3 border border-primary transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Transmit Query"
            >
              <Send size={12} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
