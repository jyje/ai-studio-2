"""In-memory session store for multi-turn conversation history."""

import uuid
from typing import Dict, List, Optional
from datetime import datetime
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage


class SessionMessage:
    """Represents a message in a session."""
    
    def __init__(self, role: str, content: str, timestamp: Optional[datetime] = None):
        """Initialize a session message.
        
        Args:
            role: Message role ('user', 'assistant', or 'system').
            content: Message content.
            timestamp: Optional timestamp for the message.
        """
        self.role = role
        self.content = content
        self.timestamp = timestamp or datetime.now()
    
    def to_langchain_message(self) -> BaseMessage:
        """Convert to LangChain message format.
        
        Returns:
            LangChain BaseMessage instance.
        """
        if self.role == 'user':
            return HumanMessage(content=self.content)
        elif self.role == 'assistant':
            return AIMessage(content=self.content)
        elif self.role == 'system':
            return SystemMessage(content=self.content)
        else:
            # Default to human message for unknown roles
            return HumanMessage(content=self.content)
    
    def to_dict(self) -> dict:
        """Convert to dictionary format.
        
        Returns:
            Dictionary representation of the message.
        """
        return {
            'role': self.role,
            'content': self.content,
        }


class Session:
    """Represents a chat session with message history."""
    
    def __init__(self, session_id: str):
        """Initialize a session.
        
        Args:
            session_id: Unique identifier for the session.
        """
        self.session_id = session_id
        self.messages: List[SessionMessage] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def add_message(self, role: str, content: str) -> SessionMessage:
        """Add a message to the session.
        
        Args:
            role: Message role ('user', 'assistant', or 'system').
            content: Message content.
            
        Returns:
            The created SessionMessage.
        """
        message = SessionMessage(role=role, content=content)
        self.messages.append(message)
        self.updated_at = datetime.now()
        return message
    
    def get_messages(self) -> List[SessionMessage]:
        """Get all messages in the session.
        
        Returns:
            List of SessionMessage objects.
        """
        return self.messages
    
    def get_langchain_messages(self) -> List[BaseMessage]:
        """Get all messages as LangChain message objects.
        
        Returns:
            List of LangChain BaseMessage objects.
        """
        return [msg.to_langchain_message() for msg in self.messages]
    
    def get_dict_messages(self) -> List[dict]:
        """Get all messages as dictionaries.
        
        Returns:
            List of message dictionaries with 'role' and 'content' keys.
        """
        return [msg.to_dict() for msg in self.messages]
    
    def clear(self):
        """Clear all messages in the session."""
        self.messages = []
        self.updated_at = datetime.now()


class InMemorySessionStore:
    """In-memory storage for chat sessions."""
    
    def __init__(self):
        """Initialize the session store."""
        self._sessions: Dict[str, Session] = {}
    
    def create_session(self, session_id: Optional[str] = None) -> Session:
        """Create a new session.
        
        Args:
            session_id: Optional custom session ID. If not provided, a UUID will be generated.
            
        Returns:
            The created Session object.
        """
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        session = Session(session_id=session_id)
        self._sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID.
        
        Args:
            session_id: The session ID to look up.
            
        Returns:
            Session object if found, None otherwise.
        """
        return self._sessions.get(session_id)
    
    def get_or_create_session(self, session_id: str) -> Session:
        """Get an existing session or create a new one.
        
        Args:
            session_id: The session ID to look up or create.
            
        Returns:
            Session object (existing or newly created).
        """
        session = self.get_session(session_id)
        if session is None:
            session = self.create_session(session_id)
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session by ID.
        
        Args:
            session_id: The session ID to delete.
            
        Returns:
            True if session was deleted, False if it didn't exist.
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
    
    def clear_all_sessions(self):
        """Clear all sessions from the store."""
        self._sessions.clear()
    
    def list_sessions(self) -> List[str]:
        """List all session IDs.
        
        Returns:
            List of session IDs.
        """
        return list(self._sessions.keys())
    
    def add_message(self, session_id: str, role: str, content: str) -> SessionMessage:
        """Add a message to a session, creating the session if it doesn't exist.
        
        Args:
            session_id: The session ID.
            role: Message role ('user', 'assistant', or 'system').
            content: Message content.
            
        Returns:
            The created SessionMessage.
        """
        session = self.get_or_create_session(session_id)
        return session.add_message(role, content)
    
    def get_messages(self, session_id: str) -> List[SessionMessage]:
        """Get all messages for a session.
        
        Args:
            session_id: The session ID.
            
        Returns:
            List of SessionMessage objects (empty list if session doesn't exist).
        """
        session = self.get_session(session_id)
        if session is None:
            return []
        return session.get_messages()
    
    def get_langchain_messages(self, session_id: str) -> List[BaseMessage]:
        """Get all messages for a session as LangChain messages.
        
        Args:
            session_id: The session ID.
            
        Returns:
            List of LangChain BaseMessage objects.
        """
        session = self.get_session(session_id)
        if session is None:
            return []
        return session.get_langchain_messages()
    
    def get_dict_messages(self, session_id: str) -> List[dict]:
        """Get all messages for a session as dictionaries.
        
        Args:
            session_id: The session ID.
            
        Returns:
            List of message dictionaries.
        """
        session = self.get_session(session_id)
        if session is None:
            return []
        return session.get_dict_messages()


# Global session store instance
session_store = InMemorySessionStore()

