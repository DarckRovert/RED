from setuptools import setup, find_packages

setup(
    name="red-messaging",
    version="0.1.0",
    description="Python bindings for RED secure messaging system",
    author="RED Team",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        # When using PyO3:
        # "maturin>=1.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-asyncio>=0.20",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Rust",
        "Topic :: Security :: Cryptography",
    ],
)
