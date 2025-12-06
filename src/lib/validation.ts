import { z } from 'zod';

export const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255, { message: "Email too long" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(128, { message: "Password too long" }),
});

export const signUpSchema = authSchema.extend({
  username: z.string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores, and hyphens" }),
});

export const messageSchema = z.object({
  content: z.string().trim().min(1, { message: "Message cannot be empty" }).max(2000, { message: "Message too long (max 2000 characters)" }),
});

export const roomNameSchema = z.object({
  name: z.string().trim().min(1, { message: "Room name required" }).max(50, { message: "Room name too long" }),
});

export const roomCodeSchema = z.object({
  code: z.string().trim().min(1, { message: "Room code required" }).max(20, { message: "Room code too long" }),
});

// Image upload validation
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG, GIF, and WebP images are allowed" };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image must be less than 5MB" };
  }
  return { valid: true };
}
