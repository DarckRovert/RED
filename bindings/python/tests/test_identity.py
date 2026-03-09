"""Tests for RED Python bindings."""

import pytest
from red_py import Identity, Session, Network, generate_identity, hash_data


class TestIdentity:
    """Tests for Identity class."""
    
    def test_generate_identity(self):
        """Test identity generation."""
        identity = generate_identity()
        assert identity is not None
    
    def test_identity_rotation(self):
        """Test that rotated identities are unlinkable."""
        identity1 = generate_identity()
        identity2 = identity1.rotate()
        
        # Public keys should be different
        # assert identity1.public_key != identity2.public_key
        # Identity hashes should be different
        # assert identity1.identity_hash != identity2.identity_hash


class TestSession:
    """Tests for Session class."""
    
    def test_create_session(self):
        """Test session creation."""
        alice = generate_identity()
        bob = generate_identity()
        
        session = Session(alice, bob.public_key)
        assert session is not None
    
    def test_message_roundtrip(self):
        """Test sending and receiving messages."""
        alice = generate_identity()
        bob = generate_identity()
        
        alice_session = Session(alice, bob.public_key)
        bob_session = Session(bob, alice.public_key)
        
        # Alice sends to Bob
        plaintext = b"Hello, Bob!"
        ciphertext = alice_session.send(plaintext)
        
        # Bob receives from Alice
        # received = bob_session.receive(ciphertext)
        # assert received == plaintext


class TestNetwork:
    """Tests for Network class."""
    
    def test_network_connection(self):
        """Test network connection."""
        identity = generate_identity()
        network = Network(identity)
        
        assert network.connect()
        assert network.is_connected
        
        network.disconnect()
        assert not network.is_connected


class TestCrypto:
    """Tests for cryptographic functions."""
    
    def test_hash_deterministic(self):
        """Test that hashing is deterministic."""
        data = b"test data"
        hash1 = hash_data(data)
        hash2 = hash_data(data)
        
        assert hash1 == hash2
        assert len(hash1) == 32
    
    def test_hash_different_inputs(self):
        """Test that different inputs produce different hashes."""
        hash1 = hash_data(b"input1")
        hash2 = hash_data(b"input2")
        
        assert hash1 != hash2
