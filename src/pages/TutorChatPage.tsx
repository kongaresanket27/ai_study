/**
 * StudyPilot - Source-Grounded AI Tutor Chat
 * Strict grounding on retrieved course units with inline citation chips [1], [2],
 * out-of-domain detection/refusal, tutor modes, multilingual support,
 * and adaptive tone based on the student's BKT mastery state.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  BookOpen,
  AlertCircle,
  Volume2,
  Mic,
  MicOff,
  ChevronRight,
  ExternalLink,
  Layers,
  HelpCircle,
  RotateCcw,
  Bot,
  User,
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { TutorMode, Citation, ChatMessage } from '../types';
import { retrieveContextUnits } from '../services/retrieval';
import { askGroundedTutor } from '../services/geminiService';

interface TutorChatPageProps {
  store: ReturnType<typeof useAppStore>;
  initialQuery: string;
  onInitialQueryHandled: () => void;
  onNavigateToIngestion: () => void;
}

export const TutorChatPage: React.FC<TutorChatPageProps> = ({ store, initialQuery, onInitialQueryHandled, onNavigateToIngestion }) => {
  const {
    course,
    topicMastery,
    chatMessages,
    setChatMessages,
    openCitation,
    applyChatNudge,
  } = store;

  const [inputQuery, setInputQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<TutorMode>('explain');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSources, setActiveSources] = useState<Citation[]>([]);
  const [requestError, setRequestError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  // Voice speech synthesis
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = text.replace(/\[\d+\]/g, '').replace(/[#*_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Voice input via browser Web Speech API
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    setInputQuery('');

    // Append user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      mode: selectedMode,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setRequestError('');

    // 1. Retrieve top relevant units from uploaded course materials
    const retrieval = retrieveContextUnits(query, course.content_units, 4);
    setActiveSources(retrieval.citations);

    // Determine relevant topic mastery level
    let masteryLevelDesc = 'Intermediate';
    if (retrieval.relevantUnits.length > 0) {
      const topTopicId = retrieval.relevantUnits[0].topic_id;
      const tm = topicMastery.find((m) => m.topic_id === topTopicId);
      if (tm) {
        if (tm.mastery < 0.40) masteryLevelDesc = 'Critical / Beginner';
        else if (tm.mastery < 0.70) masteryLevelDesc = 'Intermediate (Needs Review)';
        else masteryLevelDesc = 'Advanced Mastered';

        // Apply slight conversational nudge
        if (selectedMode === 'eli5') {
          applyChatNudge(topTopicId, 'asked_basic_help');
        } else if (selectedMode === 'socratic') {
          applyChatNudge(topTopicId, 'deep_understanding');
        }
      }
    }

    try {
      const result = await askGroundedTutor(
        query,
        retrieval.citations,
        selectedMode,
        masteryLevelDesc,
        retrieval.isOutsideCourseMaterial
      );

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        timestamp: Date.now(),
        citations: result.citations,
        is_outside_material: result.isOutsideMaterial,
        outside_knowledge_content: result.outsideKnowledgeContent,
        suggested_follow_ups: result.suggestedFollowUps,
        learner_adaptation_note: result.learnerAdaptationNote,
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Tutor chat error:', err);
      setRequestError(err instanceof Error ? err.message : 'The tutor request failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialQuery) return;
    void handleSendMessage(initialQuery);
    onInitialQueryHandled();
  }, [initialQuery]);

  // Helper to render citation chips in assistant messages
  const renderMessageContentWithChips = (msg: ChatMessage) => {
    const parts = msg.content.split(/(\[\d+\])/g);

    return (
      <div className="space-y-3 leading-relaxed">
        <p className="whitespace-pre-wrap">
          {parts.map((part, index) => {
            const match = part.match(/\[(\d+)\]/);
            if (match && msg.citations && msg.citations.length > 0) {
              const citationIndex = parseInt(match[1], 10);
              const citation = msg.citations.find((c) => c.id === citationIndex) || msg.citations[0];

              return (
                <button
                  key={index}
                  onClick={() => openCitation(citation)}
                  title={`Source ${citationIndex}: ${citation.source_file} (${citation.source_location})`}
                  className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors shadow-xs align-baseline cursor-pointer border border-indigo-300/40 dark:border-indigo-700/50"
                >
                  <BookOpen className="w-2.5 h-2.5" />
                  <span>[{citationIndex}]</span>
                </button>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </p>

        {/* Learner Adaptation Note */}
        {msg.learner_adaptation_note && (
          <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span>{msg.learner_adaptation_note}</span>
          </div>
        )}

        {/* Off-Material Refusal Banner */}
        {msg.is_outside_material && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Not Covered in Uploaded Course Syllabus</span>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
              To prevent hallucination, StudyPilot declines to mix outside data with your exam materials.
            </p>
          </div>
        )}

        {/* Separated Outside Knowledge Box */}
        {msg.outside_knowledge_content && (
          <div className="p-3.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/20 text-xs text-purple-900 dark:text-purple-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300 text-[11px] uppercase tracking-wider">
              <span>Outside Knowledge (Unverified Against Syllabus)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {msg.outside_knowledge_content}
            </p>
          </div>
        )}

        {/* Audio Speech Trigger */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => speakText(msg.content)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <Volume2 className="w-3 h-3" />
            <span>{isSpeaking ? 'Stop Audio' : 'Listen'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Center Chat Pane */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/40 dark:bg-slate-950/40">
        {/* Tutor Mode Selector Bar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            {[
              { id: 'explain' as TutorMode, label: 'Standard Explain' },
              { id: 'eli5' as TutorMode, label: 'ELI5 (Simple)' },
              { id: 'step_by_step' as TutorMode, label: 'Step-by-Step' },
              { id: 'socratic' as TutorMode, label: 'Socratic Guiding' },
              { id: 'quiz_me' as TutorMode, label: 'Quiz Me on This' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedMode === m.id
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {course.content_units.length === 0 && (
            <div className="mx-auto max-w-xl rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-center dark:border-indigo-900 dark:bg-indigo-950/30">
              <p className="font-semibold text-slate-900 dark:text-white">Upload materials to start a grounded tutoring chat</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Answers and citations come from the sources you add.</p>
              <button onClick={onNavigateToIngestion} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Upload study materials
              </button>
            </div>
          )}
          {requestError && (
            <div role="alert" className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {requestError}
            </div>
          )}
          {chatMessages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                    isUser
                      ? 'bg-indigo-600 shadow-sm'
                      : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-sm'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    renderMessageContentWithChips(msg)
                  )}

                  {/* Suggested Follow-Ups */}
                  {msg.suggested_follow_ups && msg.suggested_follow_ups.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Suggested Follow-Up Queries
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggested_follow_ups.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left border border-slate-200 dark:border-slate-700/60 cursor-pointer"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="flex gap-3 max-w-2xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-none space-y-2 w-72 sm:w-96">
                <div className="flex items-center gap-2 text-xs text-indigo-500 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Retrieving course citations & formulating answer...</span>
                </div>
                <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse w-full" />
                <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse w-4/5" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto"
          >
            {/* Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isListening ? 'Listening...' : 'Voice Input'}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-500 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about formulas, derivations, diagrams or slide concepts..."
                className="w-full pl-4 pr-10 py-3 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="p-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            StudyPilot answers are strictly cited against your course materials. Outside queries are declined or flagged.
          </p>
        </div>
      </div>

      {/* Right Column: Active Sources Used Panel */}
      <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 hidden xl:flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Retrieved Sources
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {activeSources.length} cited
          </span>
        </div>

        {activeSources.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 space-y-2">
            <p>Sources used in answering your query will appear here with exact page, slide, or timestamp links.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSources.map((source) => (
              <div
                key={source.id}
                onClick={() => openCitation(source)}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">
                    [{source.id}] {source.source_type.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {source.source_location}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                  {source.source_title}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                  "{source.excerpt}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
