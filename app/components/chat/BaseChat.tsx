/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';
import { curateModelList, curateProviderList } from '~/utils/curatedModels';
import { authUserAtom } from '~/lib/stores/auth';
import { listUserWorkspaces } from '~/lib/persistence/serverSync';
import type { BuildPlan } from '~/lib/build-plan';
import { BuildPlanDialog } from './BuildPlanDialog';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  data?: JSONValue[] | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
  onWebSearchResult?: (result: string) => void;
  buildPlan?: BuildPlan | null;
  onBuildPlanChange?: (plan: BuildPlan) => void;
  onApproveBuildPlan?: () => void;
  onCancelBuildPlan?: () => void;
  approvedBuildPlan?: BuildPlan | null;
  onEditBuildPlan?: () => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolResult = () => {
        throw new Error('addToolResult not implemented');
      },
      onWebSearchResult,
      buildPlan,
      onBuildPlanChange,
      onApproveBuildPlan,
      onCancelBuildPlan,
      approvedBuildPlan,
      onEditBuildPlan,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const authUser = useStore(authUserAtom);
    const [recentProjects, setRecentProjects] = useState<Array<{ id: string; url_id: string; title: string; updated_at: string }>>([]);
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const [qrModalOpen, setQrModalOpen] = useState(false);

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (authUser && !chatStarted) {
        listUserWorkspaces()
          .then((list) => setRecentProjects(list.slice(0, 4)))
          .catch(() => {});
      }
    }, [authUser, chatStarted]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(curateModelList(typedData.modelList, getApiKeysFromCookies()));
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...curateModelList(providerModels, newApiKeys)];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-row overflow-hidden w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col h-full overflow-hidden flex-shrink-0', chatStarted ? 'w-[var(--chat-min-width)]' : 'flex-1')}>
            <>
            {!chatStarted && (
              <div id="intro" className="mt-[10vh] max-w-3xl mx-auto text-center px-4 lg:px-0">
                <div className="flex items-center justify-center gap-2 mb-6 animate-fade-in">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
                    style={{ borderColor: 'rgba(255, 107, 43, 0.3)', background: 'rgba(255, 107, 43, 0.08)', color: '#FF6B2B' }}>
                    <span className="i-ph:sparkle-fill text-sm" />
                    AI-powered vibe coding for India
                  </span>
                </div>
                <h1 className="text-4xl lg:text-6xl font-black tracking-tight mb-5 animate-fade-in leading-[1.1]">
                  <span className="text-bolt-elements-textPrimary">Build anything</span>
                  <br />
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 55%, #784BA0 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    just describe it
                  </span>
                </h1>
                <p className="text-base lg:text-lg mb-8 text-bolt-elements-textSecondary animate-fade-in animation-delay-200 max-w-xl mx-auto leading-relaxed">
                  Create stunning websites, apps, and prototypes in seconds. No coding skills needed — just your ideas.
                </p>
                {/* Recent projects for logged-in users */}
                {authUser && recentProjects.length > 0 && (
                  <div className="mb-8 animate-fade-in animation-delay-200">
                    <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto">
                      <span className="text-sm font-semibold text-bolt-elements-textSecondary flex items-center gap-1.5">
                        <span className="i-ph:clock-clockwise text-base" />
                        Continue where you left off
                      </span>
                      <a href="/projects" className="text-xs text-orange-500 hover:text-orange-400 transition-colors font-medium">
                        View all →
                      </a>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
                      {recentProjects.map((ws) => (
                        <a
                          key={ws.id}
                          href={`/chat/${ws.url_id}`}
                          className="group flex flex-col rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-orange-500/40 hover:shadow-md transition-all p-3 text-left"
                        >
                          <div
                            className="flex items-center justify-center w-7 h-7 rounded-lg mb-2 shrink-0"
                            style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.15) 0%, rgba(255,60,172,0.15) 100%)' }}
                          >
                            <span className="i-ph:code-block text-sm" style={{ color: '#FF6B2B' }} />
                          </div>
                          <p className="text-xs font-medium text-bolt-elements-textPrimary truncate leading-snug">
                            {ws.title || 'Untitled'}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {/* How it works: describe → preview → publish */}
                <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 mb-10 animate-fade-in animation-delay-200 max-w-2xl mx-auto">
                  {[
                    { icon: 'i-ph:chat-teardrop-text', step: '1', title: 'Describe', text: 'Tell Neyla what you want to build, in your own words' },
                    { icon: 'i-ph:eye', step: '2', title: 'Preview', text: 'Watch your app come to life instantly in the browser' },
                    { icon: 'i-ph:rocket-launch', step: '3', title: 'Publish', text: 'Put it online with one click and share the link' },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="flex-1 flex flex-col items-center gap-1.5 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2/60 px-4 py-3 text-center"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #FF6B2B 0%, #FF3CAC 100%)' }}
                        >
                          {item.step}
                        </span>
                        <span className={`${item.icon} text-lg`} style={{ color: '#FF6B2B' }} />
                        <span className="text-sm font-semibold text-bolt-elements-textPrimary">{item.title}</span>
                      </div>
                      <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <StickToBottom
              className={classNames('pt-6 px-2 sm:px-6 relative', {
                'h-full flex flex-col modern-scrollbar': chatStarted,
              })}
              resize="smooth"
              initial="smooth"
            >
              <StickToBottom.Content className="flex flex-col gap-4 relative ">
                <ClientOnly>
                  {() => {
                    return chatStarted ? (
                      <Messages
                        className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1"
                        messages={messages}
                        isStreaming={isStreaming}
                        append={append}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                        provider={provider}
                        model={model}
                        addToolResult={addToolResult}
                      />
                    ) : null;
                  }}
                </ClientOnly>
                <ScrollToBottom />
              </StickToBottom.Content>
              <div
                className={classNames('my-auto flex flex-col gap-2 w-full max-w-chat mx-auto z-prompt mb-6', {
                  'sticky bottom-2': chatStarted,
                })}
              >
                <div className="flex flex-col gap-2">
                  {deployAlert && (
                    <DeployChatAlert
                      alert={deployAlert}
                      clearAlert={() => clearDeployAlert?.()}
                      postMessage={(message: string | undefined) => {
                        sendMessage?.({} as any, message);
                        clearSupabaseAlert?.();
                      }}
                    />
                  )}
                  {supabaseAlert && (
                    <SupabaseChatAlert
                      alert={supabaseAlert}
                      clearAlert={() => clearSupabaseAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearSupabaseAlert?.();
                      }}
                    />
                  )}
                  {actionAlert && (
                    <ChatAlert
                      alert={actionAlert}
                      clearAlert={() => clearAlert?.()}
                      postMessage={(message) => {
                        sendMessage?.({} as any, message);
                        clearAlert?.();
                      }}
                    />
                  )}
                  {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                {approvedBuildPlan && (
                  <button
                    type="button"
                    onClick={onEditBuildPlan}
                    className="flex items-center justify-between rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-left text-xs transition hover:border-bolt-elements-focus"
                  >
                    <span>
                      <span className="font-medium text-bolt-elements-textPrimary">Build plan saved</span>
                      <span className="ml-2 text-bolt-elements-textSecondary">
                        {approvedBuildPlan.specification.projectName}
                      </span>
                    </span>
                    <span className="text-bolt-elements-textSecondary">Review</span>
                  </button>
                )}
                <ChatBox
                  isModelSettingsCollapsed={isModelSettingsCollapsed}
                  setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                  provider={provider}
                  setProvider={setProvider}
                  providerList={curateProviderList(
                    providerList && providerList.length > 0 ? providerList : (PROVIDER_LIST as ProviderInfo[]),
                    apiKeys,
                  )}
                  model={model}
                  setModel={setModel}
                  modelList={modelList}
                  apiKeys={apiKeys}
                  isModelLoading={isModelLoading}
                  onApiKeysChange={onApiKeysChange}
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  imageDataList={imageDataList}
                  setImageDataList={setImageDataList}
                  textareaRef={textareaRef}
                  input={input}
                  handleInputChange={handleInputChange}
                  handlePaste={handlePaste}
                  TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                  TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                  isStreaming={isStreaming}
                  handleStop={handleStop}
                  handleSendMessage={handleSendMessage}
                  enhancingPrompt={enhancingPrompt}
                  enhancePrompt={enhancePrompt}
                  isListening={isListening}
                  startListening={startListening}
                  stopListening={stopListening}
                  chatStarted={chatStarted}
                  exportChat={exportChat}
                  qrModalOpen={qrModalOpen}
                  setQrModalOpen={setQrModalOpen}
                  handleFileUpload={handleFileUpload}
                  chatMode={chatMode}
                  setChatMode={setChatMode}
                  designScheme={designScheme}
                  setDesignScheme={setDesignScheme}
                  selectedElement={selectedElement}
                  setSelectedElement={setSelectedElement}
                  onWebSearchResult={onWebSearchResult}
                />
              </div>
            </StickToBottom>
            <div className="flex flex-col justify-center">
              {!chatStarted && (
                <div className="flex justify-center gap-2">
                  {ImportButtons(importChat)}
                  <GitCloneButton importChat={importChat} />
                </div>
              )}
              <div className="flex flex-col gap-5">
                {!chatStarted &&
                  ExamplePrompts((event, messageInput) => {
                    if (isStreaming) {
                      handleStop?.();
                      return;
                    }

                    handleSendMessage?.(event, messageInput);
                  })}
                {!chatStarted && <StarterTemplates />}
              </div>
            </div>
            </>
          </div>
          <ClientOnly>
            {() => (
              <Workbench chatStarted={chatStarted} isStreaming={isStreaming} setSelectedElement={setSelectedElement} />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return (
      <Tooltip.Provider delayDuration={200}>
        {baseChat}
        {buildPlan && onBuildPlanChange && onApproveBuildPlan && onCancelBuildPlan && (
          <BuildPlanDialog
            plan={buildPlan}
            onChange={onBuildPlanChange}
            onApprove={onApproveBuildPlan}
            onCancel={onCancelBuildPlan}
          />
        )}
      </Tooltip.Provider>
    );
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
