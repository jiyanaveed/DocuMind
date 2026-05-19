import ChatInterface from './chat-interface';

export default function ChatPage() {
  return (
    <div className="-m-6 flex overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      <ChatInterface />
    </div>
  );
}
