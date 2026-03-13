use serde::{Deserializer, Serializer};
use serde::de::{self, Visitor};
use std::fmt;

pub fn serialize<S>(bytes: &[u8; 64], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_bytes(bytes)
}

pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 64], D::Error>
where
    D: Deserializer<'de>,
{
    struct ArrayVisitor;

    impl<'de> Visitor<'de> for ArrayVisitor {
        type Value = [u8; 64];

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("an array of length 64")
        }

        fn visit_bytes<E>(self, v: &[u8]) -> Result<[u8; 64], E>
        where
            E: de::Error,
        {
            if v.len() == 64 {
                let mut array = [0u8; 64];
                array.copy_from_slice(v);
                Ok(array)
            } else {
                Err(E::custom(format!("expected array of length 64, found {}", v.len())))
            }
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<[u8; 64], A::Error>
        where
            A: de::SeqAccess<'de>,
        {
            let mut array = [0u8; 64];
            for i in 0..64 {
                array[i] = seq.next_element()?
                    .ok_or_else(|| de::Error::invalid_length(i, &self))?;
            }
            Ok(array)
        }
    }

    deserializer.deserialize_any(ArrayVisitor)
}
