import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Send, X, Terminal, Sparkles, Brain, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";

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
  onPlanTrajectory?: (originPlanet: string, destinationPlanet: string) => void;
  onLaunchSimulation?: () => void;
  onAbortSimulation?: () => void;
  onSetTimeAcceleration?: (multiplier: number) => void;
  onSetSimulationTarget?: (targetPlanet: string) => void;
  onPlanReturnFlight?: () => void;
}

export default function SrinivasaAIChat({
  isOpen,
  onClose,
  selectedTargetName = "Sol (Sun)",
  telemetryData = {},
  onPlanTrajectory,
  onLaunchSimulation,
  onAbortSimulation,
  onSetTimeAcceleration,
  onSetSimulationTarget,
  onPlanReturnFlight
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
        content: `SYS_COMMS LINK ESTABLISHED // GEMINI 3.1 SYSTEM ACTIVE.\n\nWelcome to the SRINIVASA Orbital Simulator. I am your Tactical AI Advisor and System Manager.\n\nI can assist you with celestial trajectories, gravitational vectors, n-body physics, orbital rendezvous calculations, and rocket telemetry. You can tell me to **calculate optimal flight paths**, **engage launch engines**, **abort flights**, **adjust custom warp compression rates**, or **re-center viewport camera focus** directly through natural language in this panel!`,
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

  // Helper to parse DeepSeek reasoning steps if any models support it, but gracefully handle standard text
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
        thought = rawText.slice(thinkStart + 7).trim();
        content = "";
      }
    }
    return { thought, content };
  };

  const handleClientCommand = (name: string, args: any) => {
    try {
      switch (name) {
        case "plan_optimized_flight":
          if (onPlanTrajectory && args.originPlanet && args.destinationPlanet) {
            onPlanTrajectory(args.originPlanet, args.destinationPlanet);
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `⚡ **CMD_EXEC**: Optimizing interplanetary trajectory flight plan: **${args.originPlanet} ➔ ${args.destinationPlanet}** using local C++ engine. Calculated parameters updated in HUD.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        case "launch_simulation":
          if (onLaunchSimulation) {
            onLaunchSimulation();
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `🚀 **CMD_EXEC**: Flight engagement command sent. Vessel is now under active propagation.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        case "abort_simulation":
          if (onAbortSimulation) {
            onAbortSimulation();
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `🛑 **CMD_EXEC**: Simulation aborted. Flight vector cleared and reset back to target origin.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        case "set_time_acceleration":
          if (onSetTimeAcceleration && typeof args.multiplier === "number") {
            onSetTimeAcceleration(args.multiplier);
            const rateText = args.multiplier === 0 ? "PAUSED" : (args.multiplier === 1 ? "1.0x (Real)" : `${args.multiplier.toLocaleString()}x`);
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `⏱️ **CMD_EXEC**: Time dilation speed rate adjusted to **${rateText}**.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        case "set_simulation_target":
          if (onSetSimulationTarget && args.targetPlanet) {
            onSetSimulationTarget(args.targetPlanet);
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `🔭 **CMD_EXEC**: Track viewport now focusing on planet celestial coordinates: **${args.targetPlanet.toUpperCase()}**.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        case "plan_return_flight":
          if (onPlanReturnFlight) {
            onPlanReturnFlight();
            setMessages(prev => [
              ...prev,
              {
                role: "assistant",
                content: `🔄 **CMD_EXEC**: Interplanetary return flight window porkchop calculated to align back to Earth orbit.`,
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          }
          break;
        default:
          console.warn("Unknown GenAI manager command received:", name);
      }
    } catch (execError: any) {
      console.error("Command execution failure:", execError);
    }
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

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Streaming is not supported by this browser.");
      }

      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "System node handshaking...",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      const lastMessageIndex = newMessages.length;

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const decodedChunk = decoder.decode(value, { stream: true });
        buffer += decodedChunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.response) {
              fullText += parsed.response;
            }

            if (parsed.command) {
              const { name, arguments: args } = parsed.command;
              handleClientCommand(name, args);
            }

            const { thought, content } = parseDeepSeekResponse(fullText);

            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: content || (thought ? "" : "Acquiring telemetric synchronization..."),
                  thought: thought || undefined
                };
              }
              return updated;
            });

            if (thought) {
              setExpandedThoughts(prev => {
                if (!prev[lastMessageIndex]) {
                  return { ...prev, [lastMessageIndex]: true };
                }
                return prev;
              });
            }
          } catch (e) {
            // Ignore partial lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          
          if (parsed.response) {
            fullText += parsed.response;
          }

          if (parsed.command) {
            const { name, arguments: args } = parsed.command;
            handleClientCommand(name, args);
          }

          const { thought, content } = parseDeepSeekResponse(fullText);

          setMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: content || "System telemetric synchronization finalized.",
                thought: thought || undefined
              };
            }
            return updated;
          });
        } catch (e) {
          // Ignore
        }
      }

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **COMMS ERROR**: Failed to connect with orbital co-processor. (${err.message || 'Check network configurations'}).`,
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
      content: `SYS_COMMS reset. GEMINI co-processor flushed. Tell me what simulated navigation commands to activate.`,
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

                  <div className="max-w-none text-[11px] space-y-1">
                    <ReactMarkdown
                      components={{
                        p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed text-[11px]" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-[11px]" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-[11px]" {...props} />,
                        li: ({ ...props }) => <li className="text-[11px]" {...props} />,
                        h1: ({ ...props }) => <h1 className="text-xs font-bold text-primary mt-3 mb-1 uppercase tracking-wider font-mono border-b border-outline-variant/30 pb-0.5" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-xs font-bold text-primary mt-2 mb-1 uppercase tracking-wider font-mono" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-[11px] font-bold text-primary-fixed mt-2 mb-1 uppercase font-mono" {...props} />,
                        code: ({ ...props }) => <code className="bg-[#111111] px-1 py-0.5 rounded text-primary-fixed font-mono text-[10px] border border-outline-variant" {...props} />,
                        pre: ({ ...props }) => <pre className="bg-[#0c0c0c] p-2 rounded-md font-mono text-[10px] my-2 overflow-x-auto border-2 border-outline-variant max-w-full text-secondary" {...props} />,
                        strong: ({ ...props }) => <strong className="font-bold text-primary-fixed" {...props} />,
                        a: ({ ...props }) => <a className="text-primary hover:underline" {...props} target="_blank" rel="noreferrer" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="self-start flex flex-col items-start max-w-[80%]">
                <span className="text-[8px] text-secondary mb-1">CO-PROCESSOR // CALCULATING</span>
                <div className="p-3 border-2 border-primary-fixed bg-black text-primary-fixed flex items-center gap-2">
                  <Terminal size={12} className="animate-spin" />
                  <TextShimmer duration={1.5} className="tracking-widest font-bold [--base-color:var(--color-primary-fixed)] [--base-gradient-color:var(--color-primary)]">
                    THINKING_WITH_DEEPSEEK_R1...
                  </TextShimmer>
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
