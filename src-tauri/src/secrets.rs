//! API-key storage. The key lives only in the OS keychain (macOS Keychain via `keyring`);
//! it is never written to the database, logs or the repo (CLAUDE.md).

pub const SERVICE: &str = "nl.procesverbetering.app";
pub const API_KEY_ACCOUNT: &str = "anthropic_api_key";

pub trait SecretStore: Send + Sync {
    fn set(&self, account: &str, secret: &str) -> Result<(), String>;
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn delete(&self, account: &str) -> Result<(), String>;
}

pub struct KeyringStore;

impl KeyringStore {
    fn entry(account: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())
    }
}

impl SecretStore for KeyringStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), String> {
        Self::entry(account)?.set_password(secret).map_err(|e| e.to_string())
    }

    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match Self::entry(account)?.get_password() {
            Ok(p) => Ok(Some(p)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        match Self::entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// In-memory store for tests.
#[cfg(test)]
#[derive(Default)]
pub struct MemoryStore(std::sync::Mutex<std::collections::HashMap<String, String>>);

#[cfg(test)]
impl SecretStore for MemoryStore {
    fn set(&self, account: &str, secret: &str) -> Result<(), String> {
        self.0.lock().map_err(|e| e.to_string())?.insert(account.into(), secret.into());
        Ok(())
    }

    fn get(&self, account: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().map_err(|e| e.to_string())?.get(account).cloned())
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        self.0.lock().map_err(|e| e.to_string())?.remove(account);
        Ok(())
    }
}

pub fn validate_api_key(key: &str) -> Result<&str, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("De API-sleutel is leeg.".into());
    }
    if trimmed.chars().any(char::is_whitespace) {
        return Err("De API-sleutel bevat spaties of regeleinden.".into());
    }
    Ok(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_store_roundtrip() {
        let store = MemoryStore::default();
        assert_eq!(store.get(API_KEY_ACCOUNT).unwrap(), None);
        store.set(API_KEY_ACCOUNT, "sk-test").unwrap();
        assert_eq!(store.get(API_KEY_ACCOUNT).unwrap().as_deref(), Some("sk-test"));
        store.delete(API_KEY_ACCOUNT).unwrap();
        assert_eq!(store.get(API_KEY_ACCOUNT).unwrap(), None);
    }

    #[test]
    fn validates_keys() {
        assert!(validate_api_key("  ").is_err());
        assert!(validate_api_key("sk ant").is_err());
        assert_eq!(validate_api_key(" sk-ant-123\n").unwrap(), "sk-ant-123");
    }
}
