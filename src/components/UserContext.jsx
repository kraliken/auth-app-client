"use client";
import { createContext, useContext } from "react";
const Ctx = createContext(null);
export const UserProvider = ({ value, children }) => (
    <Ctx.Provider value={value}>{children}</Ctx.Provider>
);
export const useUser = () => useContext(Ctx);
