const Request = require("../models/Request");

const createRequest = async (req, res) => {

    try {

        const {
            service,
            studentId,
            description
        } = req.body;


        if (!service || !studentId || !description) {

            return res.status(400).json({
                message: "Please provide all required fields"
            });

        }


        const newRequest = await Request.create({

            student: req.user.id,

            service,

            studentId,

            description

        });


        res.status(201).json({

            message: "Service request submitted successfully",

            request: newRequest

        });

    } catch (error) {

        res.status(500).json({

            message: "Failed to create service request",

            error: error.message

        });

    }
};


const getMyRequests = async (req, res) => {
    try {
        const requests = await Request.find({
            student: req.user.id
        }).sort({ createdAt: -1 });

        res.status(200).json({
            requests
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch requests",
            error: error.message
        });
    }
};

module.exports = {
    createRequest,
    getMyRequests
};