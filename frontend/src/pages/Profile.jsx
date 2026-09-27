import { useState } from "react";

function Profile() {
    const [user] = useState(() => {
        const savedUser = localStorage.getItem("user");

        return savedUser ? JSON.parse(savedUser) : null;
    });

    if (!user) {
        return (
            <div className="profile-page">
                <div className="profile-container">
                    <h1>Profile</h1>
                    <p>Please login to view your profile.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">

            <div className="profile-container">

                <div className="profile-header">
                    <div className="profile-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h1>{user.name}</h1>
                        <p>Student Account</p>
                    </div>
                </div>

                <div className="profile-details">

                    <div className="profile-item">
                        <label>Name</label>
                        <p>{user.name}</p>
                    </div>

                    <div className="profile-item">
                        <label>Email</label>
                        <p>{user.email}</p>
                    </div>

                    <div className="profile-item">
                        <label>Role</label>
                        <p>{user.role || "student"}</p>
                    </div>

                </div>

            </div>

        </div>
    );
}

export default Profile;