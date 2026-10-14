const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register
const registerUser = async (req, res) => {
    try {
        const { name, email, password, studentId, phone, role } = req.body || {};

        // Check required fields
        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                message: "Please provide name, email and password"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedStudentId =
            typeof studentId === "string" ? studentId.trim() : "";

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            ...(normalizedStudentId && { studentId: normalizedStudentId }),
            ...(typeof phone === "string" && phone.trim() && { phone: phone.trim() }),
            role: role || "student"
        });

        res.status(201).json({
            message: "Registration successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || {})[0];
            const message = duplicateField === "studentId"
                ? "Student ID already exists"
                : "User already exists";

            return res.status(409).json({ message });
        }

        console.error("Registration failed:", error);
        res.status(500).json({
            message: "Registration failed due to a server error"
        });
    }
};


// Login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                message: "Please provide email and password"
            });
        }

        // Find user
        const user = await User.findOne({ email: email.trim().toLowerCase() });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({
            message: "Login failed due to a server error"
        });
    }
};

module.exports = {
    registerUser,
    loginUser
};