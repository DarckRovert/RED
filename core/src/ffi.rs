//! C-FFI Bridge for RED Core
//!
//! This module provides a C-compatible interface for mobile integrations.
//! Error codes: 0 = success, -1 = null argument, -2 = invalid UTF-8, -3 = operation failed

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use crate::identity::Identity;
use crate::protocol::Message;

use std::sync::OnceLock;

static FFI_IDENTITY: OnceLock<Identity> = OnceLock::new();

/// Create a new identity and return its hex hash.
/// Caller is responsible for freeing the string using `red_free_string`.
/// Returns NULL on failure.
#[no_mangle]
pub extern "C" fn red_identity_create() -> *mut c_char {
    let identity = FFI_IDENTITY.get_or_init(|| {
        Identity::generate().unwrap()
    });
    
    let hash = identity.identity_hash().to_hex();
    if let Ok(cs) = CString::new(hash) {
        return cs.into_raw();
    }
    std::ptr::null_mut()
}

/// Get the hex identity hash of the current node.
/// Caller must free the returned string with `red_free_string`.
#[no_mangle]
pub extern "C" fn red_identity_hash() -> *mut c_char {
    red_identity_create()
}

/// Send a message. Returns 0 on success, negative on error.
/// Error codes: -1=null arg, -2=invalid UTF-8, -3=invalid recipient hash, -4=message creation failed
///
/// # Safety
/// Caller must ensure that `sender_ptr`, `recipient_ptr`, and `text_ptr` point to valid
/// null-terminated C strings or null pointers.
#[no_mangle]
pub unsafe extern "C" fn red_message_send(
    sender_ptr: *const c_char,
    recipient_ptr: *const c_char,
    text_ptr: *const c_char,
) -> i32 {
    // SEC-3 FIX: Use safe string conversion — return error code instead of panicking
    let sender_str = {

        if sender_ptr.is_null() { return -1; }
        match CStr::from_ptr(sender_ptr).to_str() {
            Ok(s) => s,
            Err(_) => return -2,
        }
    };
    let recipient_str = {
        if recipient_ptr.is_null() { return -1; }
        match CStr::from_ptr(recipient_ptr).to_str() {
            Ok(s) => s,
            Err(_) => return -2,
        }
    };
    let text = {
        if text_ptr.is_null() { return -1; }
        match CStr::from_ptr(text_ptr).to_str() {
            Ok(s) => {
                // SEC-FIX 6.1: Bound incoming payload to 5MB to prevent OOM attacks
                const MAX_PAYLOAD_SIZE: usize = 5 * 1024 * 1024;
                if s.len() > MAX_PAYLOAD_SIZE {
                    return -5;
                }
                s
            },
            Err(_) => return -2,
        }
    };

    // GAP-4 FIX: Use the actual sender identity hash instead of a zero placeholder
    let sender_hash = match crate::identity::IdentityHash::from_hex(sender_str) {
        Ok(h) => h,
        Err(_) => return -3,
    };
    let recipient_hash = match crate::identity::IdentityHash::from_hex(recipient_str) {
        Ok(h) => h,
        Err(_) => return -3,
    };

    match Message::text(sender_hash, recipient_hash, text) {
        Ok(_msg) => {
            // In a real mobile app, this would queue the message for the background P2P node.
            // For PoC: message is constructed and validated successfully.
            0
        }
        Err(_) => -4,
    }
}

/// Free a string allocated by the bridge.
///
/// # Safety
/// Undefined behavior if called with a pointer not allocated by this bridge or already deallocated.
#[no_mangle]
pub unsafe extern "C" fn red_free_string(s: *mut c_char) {
    if s.is_null() { return; }
    let _ = CString::from_raw(s);
}
