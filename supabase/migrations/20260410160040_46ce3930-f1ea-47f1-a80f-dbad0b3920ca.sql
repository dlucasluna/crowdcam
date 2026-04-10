
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all rooms
CREATE POLICY "Admins can view all rooms"
ON public.rooms
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
