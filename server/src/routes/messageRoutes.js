import { Router } from "express";
import { deleteConversationForUser, getConversation, getUnreadMessageCount, listConversations, markConversationRead, openVendorConversation, replyToConversation, setConversationArchived } from "../controllers/messageController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { conversationArchiveSchema, messageReplySchema, startVendorChatSchema, validate } from "../utils/validators.js";

export const messageRoutes = Router();

messageRoutes.use(authenticateUser);
messageRoutes.get("/", asyncHandler(listConversations));
messageRoutes.get("/unread-count", asyncHandler(getUnreadMessageCount));
messageRoutes.post("/vendors/:vendorId", validate(startVendorChatSchema), asyncHandler(openVendorConversation));
messageRoutes.patch("/conversations/:id/read", asyncHandler(markConversationRead));
messageRoutes.patch("/conversations/:id/archive", validate(conversationArchiveSchema), asyncHandler(setConversationArchived));
messageRoutes.delete("/conversations/:id", asyncHandler(deleteConversationForUser));
messageRoutes.get("/:id", asyncHandler(getConversation));
messageRoutes.post("/:id/reply", validate(messageReplySchema), asyncHandler(replyToConversation));
